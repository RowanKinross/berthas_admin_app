import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort } from '@fortawesome/free-solid-svg-icons';
import './summary.css';

// Helper to get weeks ago from a date string
function weeksAgo(dateStr) {
  if (!dateStr) return "-";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
}

const SORT_FIELDS = [
  { key: "totalPizzas", label: "Total Pizzas Ordered" },
  { key: "lastDeliveryDate", label: "Last Delivery Date" },
  { key: "weeksAgo", label: "Weeks Ago" },
  { key: "pizzasLastDelivery", label: "Pizzas in Last Delivery" },
  { key: "avgPizzas", label: "Average Pizzas per Order" }
];

function OrderingHabitsByCustomer({ orders = [] }) {
  const [sortField, setSortField] = useState("totalPizzas");
  const [sortDirection, setSortDirection] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");

  // Group orders by customer name and calculate stats
  const customers = useMemo(() => {
    const map = {};
    orders.forEach(order => {
      const name = order.customer_name || order.customerName || "Unknown";
      const deliveryDate = order.delivery_day || order.deliveryDate;
      // Sum all pizzas in this order
      const pizzasInOrder = Object.values(order.pizzas || {}).reduce(
        (sum, pizza) => sum + (pizza.quantity || 0), 0
      );
      if (!map[name]) map[name] = [];
      map[name].push({
        date: deliveryDate,
        pizzas: pizzasInOrder
      });
    });

    return Object.entries(map).map(([name, orders]) => {
      const totalPizzas = orders.reduce((sum, o) => sum + o.pizzas, 0);
      // Find last order by date
      const lastOrder = orders.reduce((latest, o) =>
        !latest || new Date(o.date) > new Date(latest.date) ? o : latest, null
      );
      const avgPizzas = orders.length ? (totalPizzas / orders.length).toFixed(2) : "0";
      return {
        name,
        totalPizzas,
        lastDeliveryDate: lastOrder?.date || "-",
        weeksAgo: lastOrder?.date ? weeksAgo(lastOrder.date) : "-",
        pizzasLastDelivery: lastOrder?.pizzas || "-",
        avgPizzas: parseFloat(avgPizzas)
      };
    });
  }, [orders]);

  // Filter and sort
  const filteredSortedCustomers = useMemo(() => {
    let filtered = customers;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(term)
      );
    }
    filtered = [...filtered].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      // For dates, sort by actual date
      if (sortField === "lastDeliveryDate" && aValue !== "-" && bValue !== "-") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [customers, sortField, sortDirection, searchTerm]);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <input
          type="text"
          placeholder="Search customer..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ marginRight: 12 }}
        />
      </div>
      <div style={{ display: "flex" }}>
        {/* Fixed first column */}
        <table className="stockTable" style={{ minWidth: 160, maxWidth: 200, borderRight: "1px solid #ccc" }}>
          <thead>
            <tr>
              <th>Customer Name</th>
            </tr>
          </thead>
          <tbody>
            {filteredSortedCustomers.map((customer, idx) => (
              <tr key={idx}>
                <td>{customer.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Scrollable columns */}
        <div style={{ overflowX: "auto", width: "100%" }}>
          <table className="stockTable" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                {SORT_FIELDS.map(field => (
                  <th key={field.key} style={{ cursor: "pointer" }}>
                    {field.label}
                    <span
                      className="filter"
                      style={{ marginLeft: 6 }}
                      onClick={() => {
                        if (sortField === field.key) {
                          setSortDirection(d => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setSortField(field.key);
                          setSortDirection("desc");
                        }
                      }}
                    >
                      <FontAwesomeIcon icon={faSort} />
                      {sortField === field.key && (sortDirection === "asc" ? "▲" : "▼")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSortedCustomers.map((customer, idx) => (
                <tr key={idx}>
                  <td>{customer.totalPizzas}</td>
                  <td>{customer.lastDeliveryDate}</td>
                  <td>{customer.weeksAgo}</td>
                  <td>{customer.pizzasLastDelivery}</td>
                  <td>{customer.avgPizzas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default OrderingHabitsByCustomer;
