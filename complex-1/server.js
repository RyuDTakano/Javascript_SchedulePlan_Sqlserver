// --- IMPORTS AND APP INIT AT TOP ---

// --- ENVIRONMENT VARIABLE SUPPORT ---
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import sql from 'mssql';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
app.use(cors());



// --- SQL CONFIG FROM ENVIRONMENT ---
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Connect to SQL once at startup
let sqlPool;
async function getSqlPool() {
  if (!sqlPool) {
    sqlPool = await sql.connect(config);
  }
  return sqlPool;
}


app.get('/lines', async (req, res) => {
  try {
    const pool = await getSqlPool();
    const request = pool.request();
    // Use the new Lines table
    const result = await request.query(`
      SELECT id as line_id, line as line_no, NULL as line_name FROM Lines ORDER BY id ASC
    `);
    console.log(`Lines query returned ${result.recordset.length} rows`);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Error fetching lines:', err);
    res.status(500).json({ error: err.message, lines: [] });
  }
});

app.get('/jobs', async (req, res) => {
  const { line_no } = req.query;
  if (!line_no) {
    return res.status(400).json({ error: 'Missing line_no parameter', jobs: [] });
  }
  try {
    const pool = await getSqlPool();
    const request = pool.request();
    request.input('line_no', sql.VarChar, line_no);
    console.time('jobs-query');
    const result = await request.query(`
      SELECT 
        line_no,
        lot_no,
        status,
        process_no,
        process_name,
        material_no,
        qty_used,
        process_time,
        schedule_dt,
        speculate_end_dt,
        start_dt,
        end_dt,
        queue_position,
        result,
        img,
        delay_reason,
        operator,
        log_id
      FROM tblProcessScheduleMst
      WHERE line_no = @line_no
      ORDER BY schedule_dt ASC
    `);
    console.timeEnd('jobs-query');
    console.log(`Jobs query for line ${line_no} returned ${result.recordset.length} rows`);
    // Build backend base URL
    const backendHost = req.protocol + '://' + req.hostname + ':3001';
    const formattedJobs = result.recordset.map(job => ({
      line_no: job.line_no,
      lot_no: job.lot_no,
      status: job.status,
      process_no: job.process_no,
      process_name: job.process_name,
      material_no: job.material_no,
      qty_used: job.qty_used,
      process_time: job.process_time,
      schedule_dt: job.schedule_dt,
      speculate_end_dt: job.speculate_end_dt,
      start_dt: job.start_dt,
      end_dt: job.end_dt,
      queue_position: job.queue_position,
      result: job.result,
      img: job.img ? `${backendHost}/job-image/${job.log_id}` : null,
      delay_reason: job.delay_reason,
      operator: job.operator,
      log_id: job.log_id,
      start_time: job.schedule_dt,
      end_time: job.speculate_end_dt
    }));
// Stream job image from varbinary by log_id
app.get('/job-image/:log_id', async (req, res) => {
  const { log_id } = req.params;
  try {
    const pool = await getSqlPool();
    const request = pool.request();
    request.input('log_id', sql.Int, log_id);
    const result = await request.query(`
      SELECT img FROM tblProcessScheduleMst WHERE log_id = @log_id
    `);
    if (!result.recordset.length || !result.recordset[0].img) {
      return res.status(404).send('Image not found');
    }
    const imgBuffer = result.recordset[0].img;
    // Try to detect image type (default to jpeg)
    let contentType = 'image/jpeg';
    if (imgBuffer && imgBuffer.length > 4) {
      if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50) contentType = 'image/png';
      else if (imgBuffer[0] === 0x47 && imgBuffer[1] === 0x49) contentType = 'image/gif';
      else if (imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8) contentType = 'image/jpeg';
      // Add more types if needed
    }
    res.set('Content-Type', contentType);
    res.send(imgBuffer);
  } catch (err) {
    console.error('Error streaming job image:', err);
    res.status(500).send('Error streaming image');
  }
});
    res.json(formattedJobs);
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ error: err.message, jobs: [] });
  }
});

// Start the server
app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});