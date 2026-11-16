# Bank Section Changes

## Current State
- User object from auth.me does NOT include isRootAdmin (it's in adminPermissions table)
- permsQuery.data contains list of admin permissions with isRootAdmin flag
- Current user's id is available via `user.id` from useAuth()
- To check if current user is root admin: find their entry in permsQuery.data

## Tasks
- [ ] Add `isCurrentUserRootAdmin` computed variable using permsQuery.data + user.id
- [ ] Wrap bank edit fields with root admin check (non-root sees read-only)
- [ ] Add second bank account fields (bank2.*)
- [ ] Replace copy-as-text with copy-as-image using html2canvas
- [ ] Add second bank card preview
