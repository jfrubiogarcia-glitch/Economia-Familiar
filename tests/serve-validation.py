#!/usr/bin/env python3
"""Serve two unchanged checkouts on one loopback origin for fictitious-data tests."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous', required=True, type=Path, help='Folder extracted from the previous-version ZIP')
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    roots = {'anterior': args.previous.resolve(), 'nueva': Path(__file__).resolve().parents[1]}
    for name, root in roots.items():
        if not (root / 'index.html').is_file():
            parser.error(f'No se encuentra index.html en la carpeta {name}.')
    if roots['anterior'] == roots['nueva']:
        parser.error('Selecciona dos carpetas distintas para anterior y nueva.')

    class Handler(SimpleHTTPRequestHandler):
        def do_GET(self):
            path = unquote(urlsplit(self.path).path)
            if path == '/':
                body = ('''<!doctype html><html lang="es"><meta charset="utf-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1">
                    <title>Pruebas ficticias de Economía Familiar</title>
                    <h1>Validación con datos ficticios</h1>
                    <p>Usa un perfil Invitado. No importes copias personales.</p>
                    <p><a href="/anterior/">Abrir versión anterior</a></p>
                    <p><a href="/nueva/">Abrir versión nueva (PR #2)</a></p>
                    <p>Ambas rutas comparten almacenamiento. No se sincronizan sus cambios.</p>
                    </html>''').encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            route, _, suffix = path.lstrip('/').partition('/')
            root = roots.get(route)
            if root is None or not (root / suffix).resolve().is_relative_to(root):
                self.send_error(404)
                return
            self.directory = str(root)
            self.path = '/' + suffix
            super().do_GET()

    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Solo pruebas ficticias: http://127.0.0.1:{server.server_port}', flush=True)
    print('Mantén esta terminal abierta. Ctrl+C detiene el servidor.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
