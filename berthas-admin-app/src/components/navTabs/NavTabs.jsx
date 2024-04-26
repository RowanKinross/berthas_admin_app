import { NavLink, Link } from "react-router-dom";

function NavTabs() {
  return (
    <div className="navBarContainer">
            <NavLink to="/" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
              Home
            </NavLink>
            <NavLink to="/newOrder" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
              New Order
            </NavLink>
            <NavLink to="/orderHistory" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
              Order History
            </NavLink>
            <NavLink to="/orders" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
              Orders
            </NavLink>
            <NavLink to="/inventory" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
              Inventory
            </NavLink>
            <NavLink to="/demandSummary" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
              Demand Summary
            </NavLink>
      </div>
  );
}

export default NavTabs;