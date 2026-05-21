const express    = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path       = require("path");

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, { cors: { origin: "*" } });

// roomKey = archetype number (1-9)
// chaque utilisateur qui active un mot rejoint la room de son archétype
const rooms     = new Map(); // reduced -> Set<socketId>
const userState = new Map(); // socketId -> { word, reduced, archetype, name }

io.on("connection", socket => {
  console.log("+ connected:", socket.id);

  socket.on("activate", ({ word, reduced, archetype, name }) => {
    // quitter l'ancienne room
    const prev = userState.get(socket.id);
    if (prev) {
      socket.leave("r" + prev.reduced);
      const r = rooms.get(prev.reduced);
      if (r) {
        r.delete(socket.id);
        io.to("r" + prev.reduced).emit("room_count", { reduced: prev.reduced, count: r.size });
      }
    }

    // rejoindre nouvelle room
    socket.join("r" + reduced);
    if (!rooms.has(reduced)) rooms.set(reduced, new Set());
    rooms.get(reduced).add(socket.id);
    userState.set(socket.id, { word, reduced, archetype, name });

    const count = rooms.get(reduced).size;

    // broadcast pulse à tous dans la room
    io.to("r" + reduced).emit("collective_pulse", { word, reduced, archetype, name, count });
  });

  socket.on("disconnect", () => {
    const state = userState.get(socket.id);
    if (state) {
      const r = rooms.get(state.reduced);
      if (r) {
        r.delete(socket.id);
        io.to("r" + state.reduced).emit("room_count", { reduced: state.reduced, count: r.size });
      }
      userState.delete(socket.id);
    }
    console.log("- disconnected:", socket.id);
  });

  // état global : combien par archétype
  socket.on("get_stats", () => {
    const stats = {};
    for (const [k, v] of rooms.entries()) stats[k] = v.size;
    socket.emit("stats", stats);
  });
});

// ── PROXY API ANTHROPIC ──────────────────────────────────────
const https = require("https");
app.use(express.json({limit:"50kb"}));

app.post("/api/oracle", (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Length": Buffer.byteLength(body)
    }
  };
  const proxy = https.request(options, (apiRes) => {
    res.status(apiRes.statusCode);
    apiRes.pipe(res);
  });
  proxy.on("error", e => res.status(500).json({error:e.message}));
  proxy.write(body);
  proxy.end();
});

// servir le build React en production
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "dist", "index.html"))
);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () =>
  console.log("NEXUS server → http://localhost:" + PORT)
);
