#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OB_Server.py — Servidor local Oliveira & Benedet
Execute: python OB_Server.py
Acesso:  http://IP_DO_SERVIDOR:8080
"""

import http.server
import json
import os
import sys
import threading
import socket
from datetime import datetime

PORT = 8080
DATA_FILE = "ob_data.json"
PHOTOS_FILE = "ob_photos.json"
LISTS_FILE = "ob_lists.json"

# ── Descobrir IP local ──────────────────────────────────────
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

# ── Handler ─────────────────────────────────────────────────
class OBHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, format, *args):
        now = datetime.now().strftime("%H:%M:%S")
        print(f"  [{now}] {args[0]} {args[1]}")

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_cors(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def do_OPTIONS(self):
        self.send_cors()

    def do_GET(self):
        # ── API endpoints ──
        if self.path == "/api/data":
            data = []
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            self.send_json({"records": data, "total": len(data)})

        elif self.path == "/api/photos":
            photos = {}
            if os.path.exists(PHOTOS_FILE):
                with open(PHOTOS_FILE, "r", encoding="utf-8") as f:
                    photos = json.load(f)
            self.send_json(photos)

        elif self.path == "/api/lists":
            lists = {}
            if os.path.exists(LISTS_FILE):
                with open(LISTS_FILE, "r", encoding="utf-8") as f:
                    lists = json.load(f)
            self.send_json(lists)

        elif self.path == "/api/status":
            data = []
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            self.send_json({
                "status": "ok",
                "records": len(data),
                "server": get_local_ip(),
                "port": PORT,
                "time": datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            })

        else:
            # Serve static files (dashboard HTML)
            super().do_GET()

    def do_POST(self):
        # ── Save all contracts ──
        if self.path == "/api/data":
            body = self.read_body()
            records = body.get("records", [])
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
            self.send_json({"ok": True, "saved": len(records)})

        # ── Save single contract (add or update) ──
        elif self.path == "/api/data/save":
            body = self.read_body()
            record = body.get("record", {})
            records = []
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    records = json.load(f)
            # Update if exists, otherwise append
            idx = next((i for i, r in enumerate(records) if r.get("uid") == record.get("uid")), -1)
            if idx >= 0:
                records[idx] = record
                action = "updated"
            else:
                records.append(record)
                action = "added"
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
            self.send_json({"ok": True, "action": action, "total": len(records)})

        # ── Delete single contract ──
        elif self.path == "/api/data/delete":
            body = self.read_body()
            uid = body.get("uid", "")
            records = []
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    records = json.load(f)
            before = len(records)
            records = [r for r in records if r.get("uid") != uid]
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
            self.send_json({"ok": True, "deleted": before - len(records), "total": len(records)})

        # ── Save photos ──
        elif self.path == "/api/photos":
            body = self.read_body()
            with open(PHOTOS_FILE, "w", encoding="utf-8") as f:
                json.dump(body, f, ensure_ascii=False)
            self.send_json({"ok": True})

        # ── Save lists ──
        elif self.path == "/api/lists":
            body = self.read_body()
            with open(LISTS_FILE, "w", encoding="utf-8") as f:
                json.dump(body, f, ensure_ascii=False, indent=2)
            self.send_json({"ok": True})

        else:
            self.send_json({"error": "Not found"}, 404)

# ── Main ────────────────────────────────────────────────────
if __name__ == "__main__":
    ip = get_local_ip()

    print("=" * 55)
    print("  OLIVEIRA & BENEDET — Servidor de Dashboard")
    print("=" * 55)
    print(f"\n  Iniciando na porta {PORT}...")
    print(f"\n  ✅ Acesso local:  http://localhost:{PORT}")
    print(f"  ✅ Acesso na rede: http://{ip}:{PORT}")
    print(f"\n  Compartilhe este endereço com a equipe:")
    print(f"  👉  http://{ip}:{PORT}/OB_Dashboard_Rede.html")
    print(f"\n  Pressione Ctrl+C para encerrar.")
    print("=" * 55)

    server = http.server.HTTPServer(("0.0.0.0", PORT), OBHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n  Servidor encerrado.")
