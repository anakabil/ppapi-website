# PPAPI foundation — contract audit report

Date: 2026-10-08 · Scope: `site/` shared files (main.css, core.js, auth.js, store.js, config.js, data/*.js,
styleguide.html, README.md, firestore.rules) and `devtools/FOUNDATION_NOTES.md`, checked against SPEC §2.1–2.6.

## Result
| Check | Command (from `devtools/`) | Result |
| --- | --- | --- |
| **Contract** (SPEC §2.2 API, §2.5 classes, §2.4 data, config vs research, gating) | `node flows/contract.mjs` | **248 / 248 pass** (4 real failures before fixes) |
| Foundation UI regression | `node flows/foundation-ui.mjs` | 30 / 30 |
| Demo auth regression | `node flows/auth-demo.mjs` | 53 / 53 |
| Firebase path smoke (needs internet) | `node flows/firebase-smoke.mjs` | 7 / 7 |
| Checker | `node check.mjs styleguide --full` (+ `--motion`) | 0 issues on desktop and mobile |
| Syntax | `node --check` on all site JS, data and devtools `.mjs` files | OK |

`contract.mjs` freezes the clock at 2026-10-08 10:00 WIB (Asia/Jakarta). It writes `site/__test_public|required|guest.html`,
deletes them in `finally` and asserts that none are left behind.

## Issues found and fixed
| # | Severity | Where | Problem | Fix |
| --- | --- | --- | --- | --- |
| 1 | High (visual, regulasi page) | main.css §11 table | In the stacked mobile table, `td` was a 2-column grid. Mixed cell content (`text + <span class="table__muted">`, as FOUNDATION_NOTES itself recommends) put the relevansi text into the 96px **label** column, one or two words per line. Badges and links were also stretched to full width or centred. | The label is now a floated `::before` placed in the left padding (`display:flow-root`). All cell content flows in the value column at its natural width. Re-shot and verified. |
| 2 | High (a11y, robustness) | core.js `ui.reveal` | `reveal(el)` skipped `el` itself for `[data-icon]`, `[data-scaffold]`, `[data-hero-img]`, `[data-tabs]`, `[data-accordion]` and `.marquee`, because it only queried descendants. | New `selfAndAll()` helper, so the root element is processed too. |
| 3 | High (robustness) | core.js | Any page that renders `[data-reveal]` content and forgets `ui.reveal()` left that content at opacity 0, invisible under motion, which is a likely failure for 8 independent authors. | MutationObserver safety net: element nodes added after boot are passed to `ui.reveal` on the next task. This is idempotent. Pages are still told to call `reveal()`. |
| 4 | Medium (a11y) | core.js toast | The `aria-live` region was created together with the first toast, so the first message might not be announced. MDN recommends establishing the region before its content changes. | The region is created empty at boot. |
| 5 | Medium (UX, umpan-balik) | main.css `.segmented` | The control hid overflow by scrolling sideways with no visual cue. The 5 SPEC feedback categories did not fit at 390px, so "Apresiasi" was off-screen. | Below 600px the control wraps into rows with stretched options. `.segmented--block` keeps equal halves. New opt-out class `.segmented--scroll`. The styleguide now shows all 5 categories. |
| 6 | Medium (Demo/Firebase parity) | store.js `saveMember` | Demo mode accepted any top-level key. Firebase rules (`hasOnly`) reject unknown keys, so a page could pass every demo test and then fail in production with `permission-denied`. Length limits also differed. | The Member shape is whitelisted in both modes: name ≤120, email ≤200, phone ≤24, photoURL ≤1000, profile, competencies, certificates. `profile` keeps only the 12 SPEC keys, and `experienceYears` becomes an integer or null. Anything else is dropped with one `console.warn`, which check.mjs surfaces. |
| 7 | Medium (consistency) | auth.js `updateName` | Renaming changed only the auth user, so the header and the member card/KTA could show different names. | `updateName` also calls `store.saveMember(uid,{name})` in both modes. |
| 8 | Medium (least privilege) | firestore.rules | On create, a member could self-assign `memberType` Ahli or Mitra Korporat, any KTA string and any `joinedAt`. `read` also allowed `list` queries. | Create now requires `memberType == 'Praktisi'`, KTA matching `^PPAPI-[0-9]{4}-[0-9]{6}$` and an ISO `joinedAt`. Member access is `get` only and `list` is denied. The README is updated. |
| 9 | Low (SPEC §1.3, touch ≥44px) | main.css | On mobile, breadcrumb links were 16px tall, footer links 36px, footer bottom links 22px and the brand 40px. | Under `pointer: coarse`, these get ≥44px hit areas (breadcrumb uses padding with a matching negative margin, so layout is unchanged). |
| 10 | Low (visual) | main.css `.btn:disabled` | A disabled primary button rendered as a heavy mid-grey slab (opacity .55). | Opacity is now .4. The loading state stays at .8. |
| 11 | Low (hardening) | core.js | `PPAPI.icon` put `cls` into the markup unescaped and `size` uncoerced. Social links accepted any scheme. | `cls` is escaped with `h()` and `size` is parsed with `parseInt`. Social icons render only for `http(s)://` URLs. |

All changes are documented in `FOUNDATION_NOTES.md`, in the §2 API text, §3 table and segmented, and §6 deviations 12–15.

## Verified OK (no change needed)
- Every SPEC §2.2 member exists and behaves as specified. That covers util (incl. `formatDate('2026-10-08') === '8 Oktober 2026'`, `formatDateRange`, `normalizePhoneID('0812-3456-7890') === '+6281234567890'`, `certStatus` boundaries at 0/90/91 days, deterministic `ktaFromUid`, `greeting` hour boundaries), all 71 SPEC icons, toast/modal/confirm/setLoading/tabs/accordion/emptyState/skeleton/scaffoldSVG, layout (nav, active link, Masuk/Daftar vs avatar menu, demo ribbon and its dismissal), auth demo flows and error codes, store, `onReady` ordering and error isolation, and gating (`masuk.html?next=` + encoded file, search and hash; guest redirect to a safe `next` or `dashboard.html`; `https:`, `javascript:` and `//` are rejected).
- All 138 class names from SPEC §2.5 exist, and the §1.1 primitive tokens have the exact values.
- Data files:
  - All 6 parse.
  - Ids are unique and every date is a valid ISO date.
  - berita has 10 items, dated 2026-03-12 to 2026-10-07, newest first, and every `gambar` path exists.
  - agenda has 6 upcoming items (2026-10-21 to 2027-01-21) and 4 past items.
  - regulasi has 28 items. They are field-complete, and `jenis/nomor/tahun/judul/instansi/status/kunci/tautan` match `research/regulasi.json` exactly.
  - Icon names in organisasi are valid.
  - The organisasi stats (28 regulations, 16 competencies) match the data.
  - The registry has no private fields.
- `config.contact` and `social` are all empty, matching `research/ppapi.json` (nothing verified). Both app URLs equal the researched app URL `https://ppapiid.vercel.app/`.
- Security review of shared JS. Every `innerHTML` and `insertAdjacentHTML` sink in core.js, auth.js, store.js and pages/styleguide.js inserts data or user strings through `h()`, `textContent`, or static markup. The only raw-HTML inputs are `ui.modal({body})` and `ui.emptyState({actionHtml})`, and both are documented as caller-escaped.

## Open items (not fixable in shared files, or a decision for the client)
1. Real Firebase sign-in, the rules and phone OTP still can't be tested without a real project; no rules emulator was run. The rules were checked by review and a bracket-balance check only.
2. KTA QR code on `anggota.html`: the foundation provides `util.siteUrl()` but no QR generator. The page author must add one (static, classic script).
3. With 5 categories, the wrapped `.segmented` lays out 4+1 at 390px (and 3+2 or 2+2+1 on narrower phones). This is tidy but not symmetric; a page may use its own layout if it prefers.
4. The demo ribbon adds `--ribbon-h` at boot, which causes a one-time 40px shift on guest and required pages. Heroes that use `--header-offset` absorb it.
5. All contact, social, legal and official data remain empty or placeholder until the client supplies verified facts.

## API cheat sheet (confirmed by contract.mjs)
```
Boot: config → data/*.js → core → auth → store → pages/<key>.js (all defer). Wrap page code in PPAPI.onReady(async()=>{…}).
PPAPI.config / PPAPI.data / PPAPI.onReady(fn) / PPAPI.isReady() / PPAPI.icons
util: $ $$(array) h(escape &<>"'`) formatDate(iso,{short,weekday,time,noYear}) formatDateRange(a,b) relativeTime daysUntil todayIso
      qs debounce(fn,ms=200) slugify initials greeting(date?) normalizePhoneID formatPhoneID maskPhone isEmail uid(prefix)
      storage.get/set/remove ktaFromUid(uid,year) certStatus(iso)→{key,label,days,tone} contohBadge(item) formatNumber
      parseDate safeNext(next,fallback) siteUrl(path) passwordStrength(pw) copyText img(src,{alt,cls,sizes,eager,small})
icon(name,{size=20,cls,label}) → '<svg…>' ('' + console.warn for unknown names — never pass unknown names)
ui: toast(msg,{type,timeout}) flash(msg) modal({title,eyebrow,body,size,actions[{label,variant,onClick(close)→false keeps}],onOpen,onClose})→{el,dialog,body,close}
    confirm(msg,{title,okLabel,cancelLabel,danger})→Promise<bool> setLoading(btn,on,label) reveal(root) tabs(el)→{select,current}
    accordion(el)→{open,close,toggle} otp(el,{onComplete})→{value,clear,focus,setInvalid,disable} emptyState({icon,title,text,actionHtml})
    skeleton(n=3) scaffoldSVG({cols=6,rows=4,braces,nodes,cls})
auth: mode('demo'|'firebase') ready() current() onChange(cb)→unsub signUpEmail({name,email,password}) signInEmail({email,password,remember})
      resetPassword(email) signInGoogle() [call synchronously in click] startPhone({phone,buttonEl})→{phone,masked}
      confirmPhone({code,name}) signOut() updateName(name) [also renames member] errorMessage(code). Errors: Error{.code,.message(ID)}
store: getMember(uid) ensureMember(user) saveMember(uid,patch) [whitelisted shape; profile merged; arrays replace; protected keys ignored]
       submitFeedback({kategori,nama,email,phone,subjek,pesan,rating,anonim})→{id} mode MEMBER_TYPES STATUSES LEVELS FEEDBACK_KATEGORI
Gating: body[data-auth=required] → masuk.html?next=<file+search+hash>; data-auth=guest + user → safeNext(next)|dashboard.html; data-header=solid
Declarative: [data-icon(+size,class,label)] [data-scaffold] [data-hero-img] [data-tabs][data-tab-hash] [data-accordion(="single")]
             [data-reveal(+delay)] [data-reveal-stagger] [data-count(+suffix,prefix)] .split-lines(<br>) [data-segmented] [data-copy] [data-scroll-top] [data-signout]
```

## Sources
- PPAPI facts and app details: https://ppapiid.vercel.app/ (via `devtools/research/ppapi.json`). The ppapi.id and ppapi.or.id NXDOMAIN results come from https://dns.google/resolve?name=ppapi.id&type=A and https://dns.google/resolve?name=ppapi.or.id&type=A.
- Regulations cross-checked against `devtools/research/regulasi.json`, for example https://peraturan.bpk.go.id/Details/47614 and https://peraturan.bpk.go.id/Details/37637/uu-no-2-tahun-2017.
- Live region present before content: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions
- Firestore `read` = `get` + `list` (granular operations): https://firebase.google.com/docs/firestore/security/rules-structure
- Firestore rules are not filters: https://firebase.google.com/docs/firestore/security/rules-conditions
