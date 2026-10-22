const clients = [];

const addClient = (req, res) => {
  // Headers untuk SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Kirim data awal (opsional) agar koneksi sukses dibuka
  res.write('data: {"type": "CONNECTED"}\n\n');

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res
  };
  clients.push(newClient);

  // Jika koneksi ditutup oleh client, hapus dari array
  req.on('close', () => {
    const index = clients.findIndex(c => c.id === clientId);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
};

const broadcast = (data) => {
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};

module.exports = {
  addClient,
  broadcast
};
