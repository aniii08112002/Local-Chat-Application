const { ipcRenderer } = require('electron');
const socket = io('http://localhost:3000');

document.getElementById('registerForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const username = event.target.username.value;
  const password = event.target.password.value;

  ipcRenderer.send('register', { username, password });
});

ipcRenderer.on('registerSuccess', () => {
  alert('Registration successful');
});

ipcRenderer.on('registerError', (event, message) => {
  alert(`Registration failed: ${message}`);
});

document.getElementById('loginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const username = event.target.username.value;
  const password = event.target.password.value;

  ipcRenderer.send('login', { username, password });
});

ipcRenderer.on('loginSuccess', (event, user) => {
  alert('Login successful');
  loadChatRooms(user);
});

ipcRenderer.on('loginError', (event, message) => {
  alert(`Login failed: ${message}`);
});

function loadChatRooms(user) {
  ipcRenderer.send('getRooms');

  ipcRenderer.on('getRoomsSuccess', (event, rooms) => {
    const roomsContainer = document.getElementById('roomsContainer');
    roomsContainer.innerHTML = '';

    rooms.forEach(room => {
      const roomElement = document.createElement('div');
      roomElement.textContent = room.name;
      roomElement.addEventListener('click', () => joinRoom(room.id, user.id));
      roomsContainer.appendChild(roomElement);
    });
  });

  document.getElementById('createRoomForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const roomName = event.target.roomName.value;

    ipcRenderer.send('createRoom', { name: roomName });
  });

  ipcRenderer.on('createRoomSuccess', () => {
    alert('Room created successfully');
    ipcRenderer.send('getRooms');
  });

  ipcRenderer.on('createRoomError', (event, message) => {
    alert(`Room creation failed: ${message}`);
  });
}

function joinRoom(roomId, userId) {
  socket.emit('joinRoom', { roomId, userId });

  socket.on('messageHistory', (messages) => {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '';

    messages.forEach(message => {
      const messageElement = document.createElement('div');
      messageElement.textContent = `${message.timestamp}: ${message.message}`;
      chatContainer.appendChild(messageElement);
    });
  });

  document.getElementById('sendMessageForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const message = event.target.message.value;
    socket.emit('sendMessage', { message });
  });

  socket.on('receiveMessage', (message) => {
    const chatContainer = document.getElementById('chatContainer');
    const messageElement = document.createElement('div');
    messageElement.textContent = `${message.timestamp}: ${message.message}`;
    chatContainer.appendChild(messageElement);
  });
}
