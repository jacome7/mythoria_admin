---
applyTo: '**'
---

Challenge my assumptions and provide alternative solutions.
If you are unsure about something, ask for clarification.
Do not always agree with me; provide your own perspective.
If you need to make assumptions, state them clearly.
The database schema is located within \src\db.
Always user Powershell to run commands.
When creating powershell scripts NEVER use emojies or special characters.

## Charts and Data Visualization

Use **Recharts** library for all charts and data visualizations in the admin portal.

Best practices when using Recharts:

- Always wrap charts in `ResponsiveContainer` for proper sizing and responsiveness
- Define explicit TypeScript types for all chart data structures
- Use client components (`"use client"` directive) when rendering charts
- Available chart types: AreaChart, BarChart, LineChart, ComposedChart, PieChart, RadarChart, RadialBarChart, ScatterChart, FunnelChart, Treemap, and Sankey
- Common components: ResponsiveContainer, Legend, Tooltip, XAxis, YAxis, CartesianGrid
- Make components reusable by accepting typed props for data, axis keys, and styling
- Handle asynchronous data fetching properly with loading states
- Customize tooltips and legends to match DaisyUI theme colors
