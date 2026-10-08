# Contributing

Thanks for helping improve LUMINA-AI. Focused bug fixes, accessibility improvements, documentation corrections and measured performance changes are welcome.

## Before opening an issue

1. Search existing issues and read the README.
2. Reproduce the problem on the latest `main` branch.
3. Remove credentials, private content and personal data from logs or screenshots.
4. Use the repository issue form and include the smallest reliable reproduction.

## Before opening a pull request

1. Create a focused branch and keep unrelated formatting changes out.
2. Explain the user-visible problem and the resulting behavior.
3. Run `node --check script.js`, serve the directory over HTTP and test only the mode affected by the change.
4. Update documentation when behavior or setup changes.
5. Confirm that no secret, generated build output or machine-specific file is committed.

Do not commit recordings, identifiable camera frames, model-training samples or secrets. Keep permission requests user initiated.

By contributing, you confirm that you have the right to submit the code, text and assets in your change. Security problems should be reported through [the security policy](SECURITY.md), not a public issue.
