# Crypto RSI Scanner & Advanced Charting Tool

Crypto RSI Scanner is a comprehensive, real-time dashboard and analysis tool designed for cryptocurrency traders. It provides a powerful interface to monitor the Relative Strength Index (RSI), price action, and key volume metrics for hundreds of trading pairs from the Binance exchange.

What began as a simple RSI scanner has evolved into an advanced charting platform, complete with institutional-grade indicators like Volume Profile, Fibonacci Retracement levels, and higher-timeframe analysis tools, all within a sleek, customizable, and responsive web interface.

## Core Features

### 1. Multi-View Dashboard

Instantly get a market overview with three distinct and switchable dashboard views:

-   **📈 Chart View:** The default view, displaying a grid of mini RSI charts, each showing the RSI line, its 14-period Simple Moving Average (SMA), and key overbought (70) and oversold (30) levels.
-   **♨️ Heatmap View:** A color-coded grid that provides an immediate, at-a-glance understanding of market sentiment. Cells range from deep green (oversold) to bright red (overbought), with extreme values pulsating to draw attention.
-   **💹 Price View:** A grid of mini price charts that visualize the recent price action for each symbol, color-coded based on the period's price change (green for positive, red for negative).

### 2. Advanced Interactive Charting Modal

Clicking on any symbol opens a powerful modal with in-depth analysis tools:

-   **Dual Chart Panes:** Seamlessly switch between a detailed Price Chart and an RSI Chart.
-   **Interactive Drawing Tools:**
    -   **Brush:** Free-form drawing on the chart to mark areas of interest.
    -   **Trendline:** Draw precise lines to identify trends, support, and resistance.
    -   Drawings are saved per-chart and can be cleared with a single click.
-   **Sophisticated Technical Indicators:**
    -   📊 **Volume Profile:** A vertical histogram on the price chart showing the volume traded at different price levels. It clearly visualizes the Point of Control (POC), Value Area High (VAH), and Value Area Low (VAL).
    -   **Buy vs. Sell Volume Breakdown:** The volume profile is enhanced to show a detailed breakdown of buying (teal) versus selling (maroon) pressure at each price level, offering deeper insights into market dynamics.
    -   **Golden Pocket:** Toggle a visual overlay that highlights the key Fibonacci Retracement zone (between 0.618 and 0.65), a critical area for potential price reversals.
    -   **Higher-Timeframe (HTF) Levels:** On higher timeframes (4h, 8h), you can overlay crucial levels from the *previous week* and *previous month*, including:
        -   Weekly VAH, POC, and VAL (W/Vah, w/Poc, W/Val).
        -   Monthly VAH and POC (Monthly VAH, Monthly/poc).

### 3. Full Screen Analysis Mode

For an even more focused analysis, expand the modal into a dedicated **Full View Page**. This mode features:
-   A large, two-pane layout with the Price Chart on top and the RSI Chart below.
-   Synchronized crosshairs and data tooltips across both charts.
-   Independent drawing capabilities on each pane.
-   **Chart Capture:** Copy a clean, high-resolution image of the entire chart view (including drawings and indicators) directly to your clipboard to share your analysis.

### 4. Powerful Filtering & Sorting

Quickly find the assets that matter most:

-   **Symbol Search:** A quick-access search bar to instantly filter for any symbol.
-   **Favorites System:** Star your most-watched assets. A toggle allows you to view only your favorites.
-   **Dynamic Sorting:**
    -   In RSI views, sort all symbols by RSI value (ascending or descending).
    -   In Price view, sort by the 24-hour price change percentage (ascending or descending).

### 5. Real-time Alerts & Notifications

Stay ahead of the market without being glued to the screen:

-   **Overbought/Oversold Alerts:** Receive real-time toast notifications when any symbol crosses the 70 (overbought) or 30 (oversold) RSI thresholds.
-   **Notification Center:** A persistent panel accessible from the header that stores a history of recent alerts. Unread notifications are indicated by a pulsing dot on the bell icon.
-   **Enable/Disable:** Alerts can be globally toggled on or off in the settings panel.

### 6. Deep Customization

Tailor the application to your exact preferences:

-   **Full Asset Management:**
    -   Add any symbol from the Binance market to your master list.
    -   Remove symbols you don't trade.
    -   Select exactly which symbols you want to actively monitor on the dashboard.
-   **Complete Theme Engine:**
    -   Switch between a sleek **Dark Mode** and a clean **Light Mode**.
    -   An intuitive **Theme Editor** allows you to change every color aspect of the app, including background, text, chart lines (RSI, SMA), and more. You can also adjust the chart line width.
-   **UI Preferences:** Toggle visual aids like colored borders on the grid cells that reflect their heatmap color.
-   **Reset to Default:** A one-click option to restore all settings, assets, and themes to their original state.

## Tech Stack

-   **Frontend:** Built with **React** and **TypeScript** for a robust, scalable, and maintainable codebase.
-   **Styling:** Styled with **Tailwind CSS**, a utility-first framework enabling rapid and consistent UI development.
-   **Charting:** Powered by **Recharts**, a composable charting library for React.
-   **Data Source:** Fetches real-time K-line (candlestick) data directly from the public **Binance API**.
-   **Image Generation:** Uses the **`html-to-image`** library to capture DOM elements as images for the "Copy to Clipboard" feature.
