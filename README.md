# `sse-notification-server` for Server-Sent Events (SSE)

Backend notification server to send notification message to client using Server-Sent Events (SSE)

## Explanation of some important concepts

- express js based server is created with following routes:

  - app.get('/messages', (\_, res):\_ this routes returns a list of unread messages to client

  - app.post('/messages', (req, res): this route is used to create new message. new message can be created in multiple ways using same route:

    - Using postman or curl, user sends json `{"title": "message-title", "content": "message-content", "read": false}` in req.body
    - From other system, user can send message using web form on this route.
    - This route can also be used as webhook to receive message from eventing system i.e. event-bus

  - app.put('/messages/:id', (req, res): this routes is used by client application to notify server that user has read message. using this route messages's read status is turned to true so that this message will not be returned in a response of GET /messages call.

    - note that in this poc at server, client-wise/user-wise message read status is not saved but same can be implemented.
    - if message is read by any client then then it's status is marked read.

  - app.get('/events', (req, res): this route is heart of this server for implementing SSE(server sent events). Since this is very important route so it would be explained in details separately.

- variables used to store data

  - messages: this is an array which stores messages. each message is in the format of `{id: "unique-id", "title": "message-title", "content": "message-content", "read": false}`
  - clients: this is an array to keep list of currently connected clients with event stream that is SSE connection. we need clients array for following purpose:
    - To keep record of currently connected clients with server.
    - To broadcast newly added message to all connected clients.
    - To close connection for an individual client on request of client i.e. on component unmount.
    - Each client is stored in following format `{ id: clientId, res: res}`

## Route/code for SSE(Server Sent Event)

### Code

```js
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

/**
 * @description this function is used to broadcast new message to all clients
 * @param {string} newMessage
 */
const notifyClients = (newMessage) => {
  clients.forEach((client) =>
    client.res.write(`data: ${JSON.stringify(newMessage)}\n\n`)
  );
};
```

**Supporting code**

```js
app.post('/messages', (req, res) => {
  const newMessage = { ...req.body, id: uuid() };
  messages.push(newMessage);
  notifyClients(newMessage);
  res.status(200).send('Message received');
});
```

### Some important points

#### Response Headers

- res.setHeader('Content-Type', 'text/**event-stream**');
- res.setHeader('Cache-Control', '**no-cache**');
- res.setHeader('Connection', '**keep-alive**');

#### Send a comment to keep the connection alive on interval of 20 seconds

- Code
  ```js
  // Send a comment to keep the connection alive every 20 seconds
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 20000);
  ```
- observe both res.write statements, specially what is before colon(:) when we sent message and keepAlive comment.
- note that we don't have key in res.write for keepAlive comment; while we have data key when we sent message to client using res.write.
- Initially at client end connection status shows in pending status because res.write was not exercised.
- client status transitions from pending to success as soon res.write exercised by server either by writing keepAlive comment or message on a opened stream.

#### close connection

- listen to 'close' connection event from client
  ```js
  req.on('close', () => {
    clearInterval(keepAlive);
    console.log(`Client ${clientId} connection closed`);
    clients = clients.filter((client) => client.id !== clientId);
  });
  ```
  - stop sending keepAlive comment to client because client requested to close connection
  - remove client from the active clients list.
