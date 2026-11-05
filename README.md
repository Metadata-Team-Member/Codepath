# Codepath

Teaching page for a non-technical audience: a code-list export is split into mapping files, words are loaded into lookup tables, a record keeps only the number, then a lookup brings the words back.

Uses the real export `attachments/Data_Standards_CODE_LIST_20261104.csv` (employment, gender, marital status, aboriginal status, sex at birth, state or territory).

## Run locally

Needs **Node.js 22+**.

```bash
npm install
npm run dev
```

Then open http://localhost:8080. No database and no sign-in. Leave the terminal open; stop with Ctrl+C.

## VS Code

Clone this repo, check out the `codepath` branch, open the folder, then run the two commands above in the terminal.
