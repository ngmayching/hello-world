# Joy Journal ♥

A small web app for recording the joyful actions and encounters of your day.

## Features

- **Type or speak.** Write a joy in the text box, or tap the 🎙 mic to dictate it (Web Speech API, works in Chrome, Edge and Safari).
- **Score in hearts.** Rate each moment from 1 to 5 hearts.
- **Share the best ones to Threads.** When you save a joy scored 4 or 5 hearts, the app asks whether you want to post it. You can edit the text first. Nothing is posted unless you confirm. If you say "Not now", the joy shows up later under the **Ready to share** filter.
- **History and stats.** Joys are grouped by day, with counts for today, your day streak, your average hearts and how many you've shared.
- **Private by default.** Everything is stored in your browser's `localStorage`. Use **Export** and **Import** to back it up or move it to another device.

## How Threads posting works

The app opens Threads' official web intent (`https://www.threads.net/intent/post?text=…`) with your post already filled in. You tap **Post** in Threads (or the Threads app on mobile) to publish it. No login, API key or server is needed.

## Run it

It's a static site with no build step:

```sh
cd joy-journal
python3 -m http.server 8000
# open http://localhost:8000
```

Voice input needs `localhost` or HTTPS so the browser will allow microphone access. You can also host the folder on GitHub Pages or any other static host.
