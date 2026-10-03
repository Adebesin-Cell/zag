---
"@zag-js/menu": minor
---

Added a `modal` prop to the menu. When `true`, an open menu blocks scrolling on the body, disables pointer interactions
outside it, and hides the content behind it from screen readers. It only applies to the root menu: submenus follow the
root and menubar menus ignore it. There's no separate focus trap, since the menu already keeps keyboard focus inside its
content.
