const { app, BrowserWindow, ipcMain } = require('electron');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const sqlite3 = require('better-sqlite3');

// Initialize SQLite database
const db = new sqlite3('./db/chat.db');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER,
  user_id INTEGER,
  message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(room_id) REFERENCES rooms(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

// Express server setup
const appExpress = express();
const server = http.createServer(appExpress);
const io = socketIo(server);

appExpress.use(express.json());

appExpress.post('/register', (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    stmt.run(username, hashedPassword);
    res.sendStatus(201);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

appExpress.post('/login', (req, res) => {
  const { username, password } = req.body;
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username);

  if (user && bcrypt.compareSync(password, user.password)) {
    res.json({ id: user.id, username: user.username });
  } else {
    res.status(401).send('Invalid username or password');
  }
});

appExpress.get('/rooms', (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms').all();
  res.json(rooms);
});

appExpress.post('/rooms', (req, res) => {
  const { name } = req.body;

  try {
    const stmt = db.prepare('INSERT INTO rooms (name) VALUES (?)');
    stmt.run(name);
    res.sendStatus(201);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, userId }) => {
    socket.join(roomId);

    const messages = db.prepare('SELECT * FROM messages WHERE room_id = ?').all(roomId);
    socket.emit('messageHistory', messages);

    socket.on('sendMessage', ({ message }) => {
      const stmt = db.prepare('INSERT INTO messages (room_id, user_id, message) VALUES (?, ?, ?)');
      stmt.run(roomId, userId, message);

      const newMessage = {
        id: stmt.lastInsertRowid,
        room_id: roomId,
        user_id: userId,
        message,
        timestamp: new Date()
      };

      io.to(roomId).emit('receiveMessage', newMessage);
    });
  });
});

server.listen(3000, () => {
  console.log('Express server listening on port 3000');
});

app.on('ready', () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    }
  });

  mainWindow.loadFile('index.html');

  ipcMain.on('register', (event, userData) => {
    const { username, password } = userData;
    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
      const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
      stmt.run(username, hashedPassword);
      event.reply('registerSuccess');
    } catch (err) {
      event.reply('registerError', err.message);
    }
  });

  ipcMain.on('login', (event, userData) => {
    const { username, password } = userData;
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);

    if (user && bcrypt.compareSync(password, user.password)) {
      event.reply('loginSuccess', { id: user.id, username: user.username });
    } else {
      event.reply('loginError', 'Invalid username or password');
    }
  });

  ipcMain.on('createRoom', (event, roomData) => {
    const { name } = roomData;

    try {
      const stmt = db.prepare('INSERT INTO rooms (name) VALUES (?)');
      stmt.run(name);
      event.reply('createRoomSuccess');
    } catch (err) {
      event.reply('createRoomError', err.message);
    }
  });

  ipcMain.on('getRooms', (event) => {
    const rooms = db.prepare('SELECT * FROM rooms').all();
    event.reply('getRoomsSuccess', rooms);
  });
});
