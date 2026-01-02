# Gate Timeline - Power BI Custom Visual

Custom visual for Power BI that displays an airport gate occupancy timeline using D3.js.

## Description

Gate Timeline is a custom visual developed for Microsoft Power BI that allows you to visualize airport gate occupancy over time. The visual displays:

- **Scheduled time bars**: Planned gate occupancy time
- **Actual time bars**: Real gate occupancy time
- **Ground lines**: Period when the aircraft is on the ground
- **Tow events**: Tow-in and tow-out events
- **Current time line**: Visual indicator of the present moment
- **Resource labels**: Information about flights, airlines, and aircraft

## Features

- Interactive gate occupancy visualization
- Support for wide-body gates (with parent gate grouping)
- Customizable color coding
- Tooltips with detailed flight information
- Filtering by terminal and flight type (domestic/international)
- Horizontal and vertical scrolling for large datasets
- Live timeline showing the current moment

## Data Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| **Gate** | Grouping | Gate identifier |
| **Actual Start** | Grouping | Actual occupancy start time |
| **Actual End** | Grouping | Actual occupancy end time |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| **Parent Gate** | Grouping | Parent gate for wide-body aircraft |
| **Color/Legend** | Grouping | Field for color encoding |
| **Resource Label** | Grouping | Label displayed on bars |
| **Scheduled Start** | Grouping | Scheduled start time |
| **Scheduled End** | Grouping | Scheduled end time |
| **Ground Start** | Grouping | Ground start time |
| **Ground End** | Grouping | Ground end time |
| **Landed Time** | Grouping | Landing time |
| **Operation Time** | Grouping | Operation time |
| **Tow On** | Grouping | Tow-in time |
| **Tow On Status** | Grouping | Tow-in status |
| **Tow Off** | Grouping | Tow-out time |
| **Tow Off Status** | Grouping | Tow-out status |
| **Airline** | Grouping | Airline |
| **Flight Number** | Grouping | Flight number |
| **Tail Number** | Grouping | Aircraft tail number |
| **Aircraft Model** | Grouping | Aircraft model |
| **Turn ID** | Grouping | Turn identifier |
| **Turn Duration** | Grouping | Turn duration |
| **Terminal** | Grouping | Terminal |
| **Domestic/International** | Grouping | Flight type |
| **Tooltips** | Grouping | Additional fields for tooltips (up to 10) |

## Installation and Development

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- Power BI Desktop
- PowerBI-visuals-tools installed globally

```bash
npm install -g powerbi-visuals-tools
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/example/gateTimeline.git
cd bi-airport
```

2. Install dependencies:
```bash
npm install
```

### Development

To start development mode:

```bash
npm start
```

This will start the development server at `https://localhost:8080`. You can load the visual in Power BI Desktop by following these steps:

1. Open Power BI Desktop
2. Enable developer mode in: File > Options and settings > Options > Preview features > Developer visual
3. In the visualizations pane, select the "Developer visual" icon
4. The visual will automatically connect to the development server

### Linting

To check the code:

```bash
npm run lint
```

### Packaging

To create a `.pbiviz` package for distribution:

```bash
npm run package
```

The `.pbiviz` file will be generated in the `dist/` folder.

## Main Dependencies

- **D3.js v7.9.0**: Data visualization library
- **powerbi-visuals-api ~5.3.0**: Power BI API for custom visuals
- **powerbi-visuals-tools ^7.0.2**: Development tools for Power BI visuals
- **TypeScript ^5.5.4**: Programming language

## Project Structure

```
bi-airport/
├── assets/              # Static resources (icons, images)
├── dist/                # Compiled files and packages
├── src/                 # Source code
│   ├── campos/          # Rendering modules by component
│   │   ├── actual.ts    # Actual bars rendering
│   │   ├── color.ts     # Color scale
│   │   ├── ground.ts    # Ground lines
│   │   ├── labels.ts    # Resource labels
│   │   ├── nowLine.ts   # Current time line
│   │   ├── scheduled.ts # Scheduled bars
│   │   └── tow.ts       # Tow events
│   ├── model.ts         # Data models
│   ├── parse.ts         # Power BI data parsing
│   ├── settings.ts      # Visual settings
│   └── visual.ts        # Main visual class
├── style/               # LESS styles
├── capabilities.json    # Visual capabilities definition
├── package.json         # Dependencies and scripts
├── pbiviz.json          # Power BI visual configuration
└── tsconfig.json        # TypeScript configuration
```

## Customization

The visual uses an automatic color scale based on the **Color/Legend** field. Colors are automatically assigned to each unique value using the D3.js color scale.

### Layout Configuration

You can modify layout parameters in `src/visual.ts`:

```typescript
private margin = { top: 40, right: 20, bottom: 20, left: 90 };
private rowHeight = 44;       // Height of each gate row
private pxPerHour = 120;      // Pixels per hour on the time axis
```

## License

MIT

## Author

**Maria Esquivel**
- Email: mariagracielaesquivelfernandez@gmail.com

## Contributing

Contributions are welcome. Please:

1. Fork the project
2. Create a branch for your feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For support, visit: https://example.com/support

## Version

**Current version:** 1.0.0.0

## Additional Notes

- This visual is in POC (Proof of Concept) phase
- Requires Power BI Desktop version compatible with API 5.3.0 or higher
- For better performance, it is recommended to filter data before loading the visual