# Chat Espejo

Chat para dos personas, al estilo de las apps de mensajería, pero con los lados invertidos:
**tus mensajes aparecen a la izquierda** y los de la otra persona a la derecha
(se puede volver a lo normal en Ajustes → modo espejo).

- Mensajes de texto
- Fotos (se achican antes de mandarse para que viajen rápido)
- Notas de voz (tocá el micrófono para grabar y la flecha para mandar)
- Tildes de entregado y leído, aviso de "escribiendo…" y "grabando audio…"
- Modo oscuro automático

## Cómo se usa

1. Abrí la página en el celular y poné tu nombre.
2. Tocá **Mandar mi link** y mandáselo a la otra persona (o pasale tu código de 8 letras).
3. Cuando la otra persona lo abre, quedan conectados. La próxima vez se reconectan solos.

Los mensajes viajan directo entre los dos teléfonos (WebRTC, cifrado) usando el servidor público
gratuito de [PeerJS](https://peerjs.com) solo para encontrarse. Cada celular guarda su propia copia
de la conversación en el navegador.

**Importante:** los mensajes llegan cuando los dos tienen la página abierta. Si la otra persona no
está, tu mensaje queda con un relojito y se manda solo cuando entra. No hay notificaciones con la
página cerrada.

## Publicarla con GitHub Pages

En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, elegí la rama `main`
y la carpeta `/ (root)`, y guardá. En un par de minutos queda en
`https://<tu-usuario>.github.io/<repo>/`. Hace falta HTTPS para que funcione el micrófono, y
GitHub Pages ya lo trae.
