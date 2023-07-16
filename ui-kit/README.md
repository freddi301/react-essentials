# Ui kit

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

# Replicate

- search-engine (google.com)
- chat (whatsapp.com)
- email (outlook.com)
- gallery (youtube.com, instagram.com)
- e-commerce (amazon.com)
- dev (github.com)
- admin (https://minimals.cc/)

# Common Elements

Almost every page has:

- left bar (usually nav) with collapsible items
- top bar (usually nav or header for content + searchbar)
  - logo
  - breadcrumbs
- left bar (section nav or details)
- footer (usally more info, links, etc)
- tabs (usually right below top bar, for switching between sections)
- cards
  - image (top or left)
  - title (optionally links/button to the right)
  - badges
  - subtitle
  - text
  - links / buttons (bottom or on the right of the title)
- tables
  - filters / search bar + actions
  - tabs
  - headers + ordering
  - rows (not always exatly 1 line of text) + row actions, row select
  - pagination
- forms
  - form sections (form fields)
  - text field
    - label
    - inset icon
    - error
  - select field (from simple select to autocomplete with search)
  - checkbox
  - radio
  - calendar
  - error alerts
- dropdowns
- left bar for advanced search (expandable checkboxes, etc)
- badges (decoration for secondary info)

# Colors

See colorandcontrast.com

- primary text color
- secondary text color (for secondary info)
- primary background color (to pop out sections)
- secondary background color (as background to sections)
- hover background color
- button color (for submit actions)
- link color (for navigation actions)
- border color (for card borders and separate sections or table rows/columns)

both text colors must have good contrast wiht both background colors

always provide light and dark theme (must repsect accessbility too)

# Spacing

Content is organized by spacing (it can be strenghtened with background color + borders)
Importance is expressend with font weight + size and color

# Other notes

- number in tables must be aligned right

Mandatory
Ui must look organized only by using mandatory style, optional style is enhancement
All information should be expressed by text
Organizatuon must be expressend by spacing, text size (title, subtitle, paragraph) and postioning
In cards avoid label: value use postioning/font weight
In tables label is the column name, value is the cell
Only one size horzontal and vertical spacing should be used for list-item./ Section
Inouts must have different background color

Optional
Organization can be enhanced by background-color (primary, seocndary) and/or border (one type of border)
Badges for secondary text info
Font-weigh (bold 600/regular 700)
Font-color (primary/secondary)

Basic view structure
Text only, veritical section with title and parapgraphs
Tables/lists
Cards

Other
List/table items (like rows in a table, same entities) must have hover background
Actions must be buttons
Navigation must be links
Diabled-ui-state must be provided for loading states and or unallowed actions
Contextual actions may appear only if all info for a informed user decision is on screen
Only one font for text, monosoaced version for code
