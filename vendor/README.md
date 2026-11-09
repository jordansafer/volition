# Bundled site-boundary parser

`tldts-7.4.19.min.js` is the unmodified UMD browser bundle from
[`tldts` 7.4.19](https://www.npmjs.com/package/tldts/v/7.4.19), distributed
under the MIT license in `tldts-LICENSE`.

Source: <https://github.com/remusao/tldts>.
Package: <https://registry.npmjs.org/tldts/-/tldts-7.4.19.tgz>.
Verified package integrity:
`sha512-48dH6aSpQnpbzDUc4vIQZ1VjB8tkK+e8c1yx05/SZK+rkssgjEOlxDd/yU8/a4vGYQ9vRgJr9dwMq9TJ0b3X2Q==`.

Volition enables `allowPrivateDomains` so unrelated tenants on services such
as `github.io` and `blogspot.com` never share an approval. Unknown suffixes
and IP addresses use exact-host scope. The parser and suffix data are
packaged locally; runtime lookup does not contact an external service.

To update, fetch and integrity-check a pinned npm release, replace its UMD
bundle and license, update both script references and this record, and run
the approval-context, provider, and frozen-text tests before packaging.
