/**
 * Document Operations API Routes
 */

import express from 'express';
import documentOps from '../services/document-operations.js';

const router = express.Router();

/**
 * POST /api/operations/position-cursor
 * Find and select text in the document
 */
router.post('/position-cursor', async (req, res) => {
  try {
    const { docUrl, collabUrl, text } = req.body;
    
    if (!docUrl || !collabUrl || !text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: docUrl, collabUrl, text'
      });
    }

    const result = await documentOps.positionCursor(docUrl, collabUrl, text);
    res.json(result);
  } catch (error) {
    console.error('Error in position-cursor:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/operations/delete-block
 * Delete the current block at cursor
 */
router.post('/delete-block', async (req, res) => {
  try {
    const { docUrl, collabUrl } = req.body;
    
    if (!docUrl || !collabUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: docUrl, collabUrl'
      });
    }

    const result = await documentOps.deleteBlock(docUrl, collabUrl);
    res.json(result);
  } catch (error) {
    console.error('Error in delete-block:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/operations/insert-at-cursor
 * Insert content at cursor position
 */
router.post('/insert-at-cursor', async (req, res) => {
  try {
    const { docUrl, collabUrl, text, nodeType } = req.body;
    
    if (!docUrl || !collabUrl || !text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: docUrl, collabUrl, text'
      });
    }

    const result = await documentOps.insertAtCursor(docUrl, collabUrl, text, nodeType || 'paragraph');
    res.json(result);
  } catch (error) {
    console.error('Error in insert-at-cursor:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/operations/replace-text
 * Find and replace text
 */
router.post('/replace-text', async (req, res) => {
  try {
    const { docUrl, collabUrl, find, replace } = req.body;
    
    if (!docUrl || !collabUrl || !find || !replace) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: docUrl, collabUrl, find, replace'
      });
    }

    const result = await documentOps.replaceText(docUrl, collabUrl, find, replace);
    res.json(result);
  } catch (error) {
    console.error('Error in replace-text:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/operations/disconnect
 * Disconnect from a document
 */
router.post('/disconnect', async (req, res) => {
  try {
    const { docUrl, collabUrl } = req.body;
    
    if (!docUrl || !collabUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: docUrl, collabUrl'
      });
    }

    documentOps.disconnect(docUrl, collabUrl);
    res.json({ success: true, message: 'Disconnected' });
  } catch (error) {
    console.error('Error in disconnect:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

