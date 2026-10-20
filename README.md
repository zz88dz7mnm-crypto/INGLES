# Chat Espejo

Chat privado para dos personas, **Juan y Marti**, con los lados invertidos: **tus mensajes van a la
izquierda** y los del otro a la derecha (se puede volver a lo normal en Ajustes → modo espejo).

- Mensajes de texto, fotos y notas de voz.
- Tildes de enviado (✓) y leído (✓✓ azul).
- Modo oscuro automático.
- Sin cuentas ni instalación: es una sola página, `index.html`.

## Cómo se usa

1. Los dos abren la misma dirección (https://ingles-marti.vercel.app).
2. Cada uno toca **Soy Juan** o **Soy Marti**.
3. Los dos escriben la **misma clave**: cualquier frase, por ejemplo `pelota azul 77`. Se pone una
   sola vez y queda guardada en el celular. No importan las mayúsculas, las tildes ni los espacios
   de más.

Si no se ven los mensajes, lo primero es comparar la clave en Ajustes (los tres puntitos): tiene que
ser igual en los dos celulares.

## Cómo funciona

Los mensajes no van directo de un celular al otro. Pasan por un buzón público y gratuito
([ntfy.sh](https://ntfy.sh)) que los guarda hasta que el otro abra la página. Por eso llegan aunque
el otro tenga la página cerrada.

- Cada mensaje, foto y audio se cifra en el celular (AES-GCM) con una clave que sale de la frase
  compartida. El buzón solo ve datos cifrados.
- El nombre de cada buzón también sale de la frase, así que sin la clave no se puede encontrar ni
  leer la conversación.
- Cada celular guarda su copia de la conversación en el navegador (IndexedDB).
- La página se queda escuchando su buzón en tiempo real. Si esa conexión falla, consulta cada pocos
  segundos.

## Límites

- El buzón guarda los mensajes **12 horas** y las fotos y audios **3 horas**. Si el otro abre la
  página después, llega el texto pero no el archivo.
- ntfy.sh limita los pedidos de cada conexión. En un chat normal no se llega, y si pasa, la página
  avisa y reintenta sola.
- No hay notificaciones con la página cerrada.
- El nombre elegido, la clave y el historial se guardan por dirección web. Si abren la página desde
  otra dirección, empiezan de cero.

## Publicarla

Es un sitio estático sin proceso de armado. Sirve cualquier hosting (Vercel, GitHub Pages, Netlify).
Hace falta `https` para el micrófono y el cifrado.

Para usar otro servidor ntfy (por ejemplo uno propio), definir antes del script
`window.CHAT_RELAY = "https://mi-servidor"`.

## Práctica de inglés

`ingles.html` (https://ingles-marti.vercel.app/ingles.html) es la página de ejercicios de inglés:
Past Perfect vs Past Simple y vocabulario de trabajo, con teoría, línea de tiempo y ejercicios con
puntaje.
