// pages/api/verify.js
'use server';

export default function handler(req, res) {
  console.log('Received request', req.method, req.body);

  if (req.method === 'POST') {
    const { password } = req.body;

    if (password === process.env.NEXT_PUBLIC_SECRET_PASSWORD) {
      const playbackId = 'd3ff6iptj4i1ofzj';
      res.status(200).json({ success: true, playbackId });
    } else {
      res.status(401).json({ success: false, message: 'Incorrect password.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
