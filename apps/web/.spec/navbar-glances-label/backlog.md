# Navbar "Glances" Label - Feature Backlog

## 🔧 Robust Enhancements
**Effort**: 2-3 hours

### Add "All Notes" Navbar Item
- Add fourth navigation item for direct access to full list
- Label: "All Notes", href: `/notes`, icon: FileText
- Update navbar layout to accommodate 4 items
- Consider responsive layout for mobile
- A/B test user preference: 3 vs 4 navbar items

### Custom Icon for Glances
- Replace Home icon with more descriptive icon
- Options: Eye, Dashboard, Grid, Sparkles
- Ensure icon communicates "overview" or "quick view"
- Test icon clarity with users
- Maintain visual consistency

### Hover Tooltips
- Add tooltip on "Glances" hover
- Message: "Quick overview of priority notes"
- Add tooltip on "All Notes" (if added)
- Message: "View complete notes list"
- Use Radix Tooltip component
- Match ocean theme styling

### Active State Improvements
- Enhance visual feedback for active nav item
- Add underline or background highlight
- Improve contrast for accessibility
- Animate transitions smoothly
- Test across all pages

### Priority Badge
- Show count badge on Glances
- Display number of priority items
- Update in real-time
- Position: top-right of label
- Color: cyan accent
- Hide when count is zero

## 🚀 Advanced Features
**Effort**: 6-8 hours

### Customizable Navigation Labels
- User preferences for navbar labels
- Options: "Glances" / "Home" / "Dashboard"
- Save preference in localStorage
- Sync across sessions
- Reset to default option

### Multiple View Modes
- Add view mode switcher
- Modes: Glance, List, Grid, Calendar
- Quick-switch in navbar or page header
- Remember user's last selected mode
- Keyboard shortcuts for switching

### Quick-Switch Dropdown
- Dropdown menu in navbar
- Options: Glances, All Notes, By Category, Search
- Keyboard navigation support
- Recent views history
- Pin favorite views

### Keyboard Shortcuts
- Global shortcuts for navigation
- `G` → Jump to Glances
- `N` → Jump to All Notes
- `S` → Jump to Search
- `?` → Show keyboard shortcuts help
- Customizable by user

### Navigation Analytics
- Track which nav items are clicked
- Measure time spent on each view
- Identify common navigation patterns
- User flow visualization
- Export analytics data

### Breadcrumb Navigation
- Show navigation trail
- Example: "Glances → Todo Category"
- Click any breadcrumb to navigate
- Collapse on mobile
- Style with ocean theme

## Future Considerations

### Mobile-First Improvements
- Bottom tab bar for mobile
- Larger touch targets
- Swipe gestures between views
- Haptic feedback on navigation
- Native app-like experience

### Accessibility Enhancements
- ARIA labels for all nav items
- Keyboard focus indicators
- Screen reader announcements
- High contrast mode support
- Reduced motion preferences

### Performance Optimization
- Preload linked pages on hover
- Lazy load navigation components
- Optimize re-renders
- Cache navigation state
- Service worker for offline navigation

### Personalization
- Reorder navbar items (drag-and-drop)
- Hide/show navbar items
- Custom navigation shortcuts
- Save personal navigation preferences
- Import/export preferences

### Multi-Language Support
- Translate navigation labels
- Support RTL languages
- Localized tooltips
- Context-aware translations
- Language switcher in navbar

### Progressive Disclosure
- Show advanced options conditionally
- Beginner vs expert modes
- Contextual navigation based on usage
- Smart suggestions
- Adaptive UI based on behavior

## Testing Strategy

### Unit Tests
- Navigation config exports correctly
- Label changes applied
- Icon components render
- Links point to correct routes

### Integration Tests
- Navigation between pages works
- Active state updates correctly
- Tooltips display properly
- Shortcuts trigger navigation

### E2E Tests
- Full user flows with new labels
- Mobile and desktop navigation
- Accessibility compliance
- Performance benchmarks

### User Testing
- A/B test different labels
- Measure comprehension
- Track confusion points
- Gather qualitative feedback
- Iterate based on data

## Documentation Updates

### User Guide
- Explain Glances vs All Notes
- Navigation tips and shortcuts
- Screenshots with annotations
- Video tutorial
- FAQ section

### Developer Docs
- Navigation config schema
- Adding new nav items
- Customization guidelines
- Best practices
- Migration guide

### Changelog
- Document label change
- Explain rationale
- Note any breaking changes
- Provide upgrade path
- Archive old documentation
