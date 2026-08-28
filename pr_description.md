## Description

Fix 4 web-dashboard issues:
- Update navigation paths to use registered routes (QuickActionBar and OnboardingHints)
- Add runtime shape validation to localStorage loaders (contactsStorage and splitBillStorage)
- Remove hardcoded demo handles from production handle resolver
- Add runtime validation to useAccountOverview API response

## Type of Change

- [x] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [x] Manual testing performed (verified navigation routes and data validation logic)
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated

## Security Considerations

- Runtime validation prevents crashes from corrupted localStorage data
- Removing demo handles prevents fake data from being shown in production
- API response validation prevents malformed data from reaching UI state

## Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests pass locally
- [x] No new warnings introduced

Closes #1241, Closes #1242, Closes #1243, Closes #1244