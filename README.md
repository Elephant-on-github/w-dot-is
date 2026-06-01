# w.is

**What is, who is, where is — `w.is`**

Ask it anything. It'll draw a picture and tell you a story.

```
$ w.is banana

────────────────────────────────────────────────────────────────────────────────
                                    Banana
────────────────────────────────────────────────────────────────────────────────
            %%%%@@%%@@%%@@░@░▒▒░░░░░@- %@@@%@%%%##*=+#
            #%%@@@@░@%@@@░░@-:%▒░░░@*==+#@@@@####+=:-#
            %@@@%░@#=-#░%-=*. .+░░@=+-+++%░%#%%####*+%
            @@@+.+:--%%@%.  . +.=░==*-*++*##%%*%%###*@
            @#=:.:::=@ .--    .  :*%░:++++*%%*#%###*#@
            %::=-::==%*  .:  ... .-%░@%░░*#%**####**░░
            %::==-====**- ::....   .@▒▒▒▒%#*+#**##+@░░
            @+::==:==++++:.  -:.+*░▒▒▒▒▒▓▓░#@#:*##*░░░
            @%+::=====+**#*+==+#%▓▓▓▓▓▓▓▓▓▓▓▓▓▒@*=#░░░
            @@@#=:::=====+*#%%%%%▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒░@░@%#
            @@@░░%*=:::===+*%░▓▓▓▓▓▓▓▓▓▓▒▒░@%#*+=::---.
            @@@░░░▒▒░%%###*+==░░░@#*+=::-...  ....---:

  [living thing]
  Tropical, edible, staple fruit
  species: – Musa acuminata and Musa balbisiana, or their hybrids
  genus: Musa
────────────────────────────────────────────────────────────────────────────────
```

Want the truth? Just ask.

```
$ w.is --is banana --a fruit
true

$ w.is --is banana --a vegetable
false
```

---

## Install

```bash
npm install -g @elephant_dev/w.is
```

Then run:

```bash
w.is <name>
```

Or one-shot it:

```bash
npx @elephant_dev/w.is banana
bunx @elephant_dev/w.is banana
```

## Usage

**Look things up:**

```
w.is <name>
```

**Verify claims:**

```
w.is --is <subject> --a <predicate>
```

Examples:

```
w.is einstein
w.is france
w.is --is saturn --a planet
```

## How it works

1. **Fetches** the Wikipedia page for whatever you asked about
2. **Downloads** the article image and converts it to colored ASCII art
3. **Extracts** a short bio — description, lifespan, awards, medals, achievements
4. **Prints** it all to your terminal in glorious ANSI true color

If you use `--is` / `--a`, it skips the art and just tells you `true` or `false` by cross-referencing Wikipedia data.

The tool auto-detects your terminal's background (dark or light) so the art looks right every time.

## Categories

w.is sorts every entity into one of four buckets:

| Category | Example |
|----------|---------|
| `person` | Einstein, Duplantis, Cleopatra |
| `place` | France, Tokyo, Amazon River |
| `living_thing` | Banana, Lion, Giant Sequoia |
| `thing` | Saturn, Moon, Internet |

Each gets a tailored bio — athletes get their medals, cities get their population, species get their taxonomy.

## Requirements

- [Bun](https://bun.sh) runtime
- A terminal that speaks ANSI true color (the 2020s called)

## License

MIT — go nuts.
