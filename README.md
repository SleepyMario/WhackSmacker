# WhackSmacker

WhackSmacker is a Node.js command-line application for reviewing Anki cards from a terminal. It talks to a locally running Anki instance through the AnkiConnect add-on.

Milestone: `v0.001`

Package version: `0.0.1`

Future Git tag after manual validation: `v0.0.1`

## Prerequisites

- Node.js 18 or newer.
- Anki running on the same machine.
- The AnkiConnect add-on installed and enabled in Anki.
- AnkiConnect reachable at `http://127.0.0.1:8765`.

Install AnkiConnect from Anki with `Tools -> Add-ons -> Get Add-ons`, then use the add-on code published by AnkiConnect. Restart Anki after installing the add-on.

## Install

For local development:

```sh
npm install
npm run build
npm link
```

After linking, the executable is:

```sh
whacksmacker
```

For a no-publish package smoke test:

```sh
npm pack
npm install -g ./whacksmacker-0.0.1.tgz
whacksmacker status
npm uninstall -g whacksmacker
```

Do not publish this milestone to npm.

## Usage

Check whether AnkiConnect is reachable and usable:

```sh
whacksmacker status
```

List available Anki decks:

```sh
whacksmacker decks
```

Start a terminal review session for a deck:

```sh
whacksmacker review Default
whacksmacker review Languages::Japanese
whacksmacker review "Deck With Spaces"
```

During review:

- Press Enter to reveal the answer.
- Enter one of the answer choices shown for the current card.
- Enter `q` before reveal or at the rating prompt to stop cleanly.
- Press Ctrl-C to interrupt the session.

The review command continues until the Anki review queue is empty or you quit.

## Troubleshooting

If `whacksmacker status` prints `Unable to reach AnkiConnect`:

- Start Anki.
- Confirm the AnkiConnect add-on is installed and enabled.
- Restart Anki after installing or changing add-ons.
- Check that no firewall or local security tool is blocking `127.0.0.1:8765`.

If a command prints `AnkiConnect API error`, WhackSmacker reached AnkiConnect but AnkiConnect rejected the request. Common causes include a missing deck, an unavailable deck, or Anki not being in a state where the requested review action is valid.

If a command prints `Malformed AnkiConnect response`, AnkiConnect or another service on port `8765` returned a response WhackSmacker does not understand.

## Development

Build:

```sh
npm run build
```

Run tests with mocked AnkiConnect responses:

```sh
npm test
```

Run the built CLI directly:

```sh
node dist/main.js status
```

Tests use local mock HTTP servers and do not require a running Anki instance.

## Real-Anki Validation Checklist

Before creating Git tag `v0.0.1`, validate against a real local Anki instance:

1. Start Anki with AnkiConnect enabled.
2. Run `whacksmacker status`; confirm it reports AnkiConnect available and shows an API version.
3. Run `whacksmacker decks`; confirm known deck names are listed.
4. Run `whacksmacker review <deck-name>` for a deck with due cards.
5. Reveal a card, answer with each available choice style that appears, and confirm Anki accepts the answer.
6. Let a short queue complete and confirm WhackSmacker reports the number of answered cards.
7. Run review on a deck with no due cards and confirm it reports an empty queue cleanly.
8. Start a review and enter `q`; confirm it stops without answering the current card.
9. Start a review and press Ctrl-C; confirm the terminal returns cleanly with exit code `130`.
10. Stop Anki and run `whacksmacker status`; confirm it reports a connection failure.

Only create tag `v0.0.1` after this checklist succeeds.
