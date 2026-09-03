# KWADER Web Application

The central dashboard for the KWADER HR management system.

## 🚀 Getting Started

1.  **Installation**:
    ```bash
    cd attendpay-app
    npm install
    ```
2.  **Configuration**:
    Create a `.env` file with your Supabase credentials:
    ```env
    REACT_APP_SUPABASE_URL=your_supabase_url
    REACT_APP_SUPABASE_ANON_KEY=your_anon_key
    ```
3.  **Development**:
    ```bash
    npm start
    ```

## 🛠 Tech Stack

- **Frontend**: React 19, React Router 7
- **Backend**: Supabase (Database, Auth, Edge Functions)
- **Styling**: Vanilla CSS (Modern CSS Variables)
- **Charts**: Recharts
- **Data Export**: XLSX

## 📂 Directory Structure

- `/src/pages`: Individual dashboard views (Employees, Attendance, Payroll, etc.)
- `/src/components`: Reusable UI elements (Sidebar, TopBar, Table, etc.)
- `/src/context`: Auth and Locale state management.
- `/src/supabase`: SQL schema and function migrations.

---
Professional HR Management by KWADER.
