# Chat Espejo

Chat privado para dos personas, **Juan y Marti**, al estilo de las apps de mensajería pero con los
lados invertidos: **tus mensajes aparecen a la izquierda** y los del otro a la derecha (se puede
volver a lo normal en Ajustes → modo espejo).

- Sin códigos ni links: la primera vez cada uno toca "Soy Juan" o "Soy Marti" y queda guardado.
- Mensajes de texto, fotos y notas de voz (tocá el micrófono para grabar y la flecha para mandar).
- Tildes de entregado y leído, aviso de "escribiendo…" y "grabando audio…".
- Modo oscuro automático.

## Cómo se usa

1. Los dos abren la misma página.
2. Uno toca **Soy Juan** y el otro **Soy Marti**.
3. Listo: se conectan solos, ahora y cada vez que abran la página.

Los mensajes viajan directo entre los dos teléfonos (WebRTC, cifrado). El servidor público gratuito
de [PeerJS](https://peerjs.com) se usa solo para que los dos celulares se encuentren. Cada celular
guarda su propia copia de la conversación en el navegador.

**Importante:** los mensajes llegan cuando los dos tienen la página abierta. Si el otro no está, tu
mensaje queda con un relojito y se manda solo cuando entra. No hay notificaciones con la página
cerrada.

## Publicarla con GitHub Pages

En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, elegí la rama `main`
y la carpeta `/ (root)`, y guardá. En un par de minutos queda en
`https://zz88dz7mnm-crypto.github.io/INGLES/`. Hace falta HTTPS para el micrófono, y GitHub Pages ya
lo trae.
