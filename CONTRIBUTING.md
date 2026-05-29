# Contributing

Thanks for your interest in Conductor! Bug reports, feature requests, and PRs are all welcome.

## Development setup

```bash
git clone https://github.com/nouhouari/conductor.git
cd conductor
npm install            # installs root + example workspace
npm run build          # tsc, populates dist/
npm run test:dry-run   # validates step definitions
```

For testing with the bundled example apps:

```bash
docker compose up -d                   # postgres
cd apps/server && npm start &          # express + web UI
cd ../desktop && ./gradlew shadowJar   # JavaFX app
cd ../mobile && flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
```

Then run scenarios:

```bash
cd example
npx cucumber-js --tags '@api or @web or @desktop'
```

## Running CI locally

The GitHub Actions workflow can be exercised locally with [`act`](https://github.com/nektos/act):

```bash
act push -j build --workflows .github/workflows/ci.yml
```

`.actrc` is preconfigured to use `catthehacker/ubuntu:act-latest` and skip the Docker socket mount.

## Code style

- TypeScript strict mode, no `any` unless commented why
- One responsibility per driver / hook / page object
- Cucumber step definitions: type `this` as `ConductorWorld`
- Keep public APIs minimal — export from `src/index.ts` only what consumers need

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add JavaFX screenshot support
fix: handle Maestro gRPC UNAVAILABLE on first connect
docs: clarify how to override headless mode
chore: bump playwright to 1.50
```

## Releasing

1. Bump `version` in `package.json` and update `CHANGELOG.md`
2. Commit: `chore(release): v0.2.0`
3. Tag: `git tag v0.2.0 && git push --tags`
4. The `release.yml` workflow does the rest (GitHub release + npm publish with provenance)

`NPM_TOKEN` must be configured as a repo secret.

## Reporting bugs

Please include:

- Conductor version (`npm ls conductor-e2e`)
- Node version (`node --version`)
- Minimal reproduction (a single feature file + step definition is ideal)
- Full Cucumber output with `--format progress`
- For mobile issues: Maestro version (`maestro --version`), device type (physical / emulator), OS

Open issues at <https://github.com/nouhouari/conductor/issues>.

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
