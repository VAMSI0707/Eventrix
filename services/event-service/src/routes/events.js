const express = require('express');
const Event = require('../models/Event');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/events - Get all events (public)
router.get('/', async (req, res) => {
  try {
    const { category, search, status, sort } = req.query;
    
    let query = {};
    
    // Filter by category
    if (category) {
      query.category = category;
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Search by title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Sort options
    let sortOption = { date: 1 }; // default: upcoming first
    if (sort === 'price-asc') sortOption = { price: 1 };
    if (sort === 'price-desc') sortOption = { price: -1 };
    if (sort === 'date-desc') sortOption = { date: -1 };
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      Event.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Event.countDocuments(query)
    ]);
    
    res.json({
      events,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Failed to fetch events', details: err.message });
  }
});

// GET /api/events/:id - Get single event (public)
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ error: 'Failed to fetch event', details: err.message });
  }
});

// POST /api/events - Create event (admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const event = new Event(eventData);
    await event.save();
    
    res.status(201).json({
      message: 'Event created successfully',
      event
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event', details: err.message });
  }
});

// PUT /api/events/:id - Update event (admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({
      message: 'Event updated successfully',
      event
    });
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Failed to update event', details: err.message });
  }
});

// DELETE /api/events/:id - Delete event (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({
      message: 'Event deleted successfully',
      event
    });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Failed to delete event', details: err.message });
  }
});

// PATCH /api/events/:id/seats - Update available seats (internal use)
router.patch('/:id/seats', async (req, res) => {
  try {
    const { seatsToBook } = req.body;
    
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    if (event.availableSeats < seatsToBook) {
      return res.status(400).json({ error: 'Not enough seats available' });
    }
    
    event.availableSeats -= seatsToBook;
    await event.save();
    
    res.json({
      message: 'Seats updated successfully',
      availableSeats: event.availableSeats
    });
  } catch (err) {
    console.error('Update seats error:', err);
    res.status(500).json({ error: 'Failed to update seats', details: err.message });
  }
});

module.exports = router;