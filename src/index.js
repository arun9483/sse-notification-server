const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuid } = require('uuid');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.configDotenv();

const app = express();
app.use(cors());
const port = process.env.PORT || 4000;

app.use(bodyParser.json());

let messages = [
  { id: uuid(), title: 'Message 1', content: 'Content 1', read: false },
  // Additional messages
];

let clients = [];

/**
 * @description This part of the code is responsible for opening connection and closing connection for server sent events between client and server
 */
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = uuid();
  console.log(`Client ${clientId} connected`);

  const newClient = {
    id: clientId,
    res,
  };

  clients.push(newClient);

  // Send a comment to keep the connection alive every 20 seconds
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    console.log(`Client ${clientId} connection closed`);
    clients = clients.filter((client) => client.id !== clientId);
  });
});

app.get('/messages', (_, res) => {
  res.json(messages.filter((msg) => !msg.read));
});

app.put('/messages/:id', (req, res) => {
  const messageId = req.params.id;
  messages = messages.filter((msg) => msg.id !== messageId);
  res.status(200).send('Message marked as read');
});

app.post('/messages', (req, res) => {
  const newMessage = { ...req.body, id: uuid() };
  messages.push(newMessage);
  notifyClients(newMessage);
  res.status(200).send('Message received');
});

/**
 * @description this function is used to broadcast new message to all clients
 * @param {string} newMessage
 */
const notifyClients = (newMessage) => {
  clients.forEach((client) =>
    client.res.write(`data: ${JSON.stringify(newMessage)}\n\n`)
  );
};

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
