import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort } from '@fortawesome/free-solid-svg-icons';
import './summary.css';

// Helper to get weeks ago from a date string
function weeksAgo(dateStr) {
  if (!dateStr) return "-";
  const now = new Date();
  const date = new Date(dateStr);

  // Find the most recent Saturday before or on today
  const nowDay = now.getDay();
  const lastSaturday = new Date(now);
  lastSaturday.setDate(now.getDate() - ((nowDay + 1) % 7));

  // Find the Saturday for the order date
  const orderDay = date.getDay();
  const orderSaturday = new Date(date);
  orderSaturday.setDate(date.getDate() - ((orderDay + 1) % 7));

  // Calculate the number of weeks between the two Saturdays
  const diffMs = lastSaturday - orderSaturday;
  const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));

  // If the order is in the current week (last Saturday to coming Friday), return 0
  if (weeks < 0) return 0;
  return weeks;
}

function formatDateDMY(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

const SORT_FIELDS = [
  { key: "rank", label: <>Rank</> },
  { key: "totalPizzas", label: <>Total<br />Pizzas Ordered</> },
  { key: "lastDeliveryDate", label: <>Last<br />Delivery Date</> },
  { key: "weeksAgo", label: <>Weeks<br />Ago</> },
  { key: "pizzasLastDelivery", label: <>Pizzas in <br /> Last Delivery</> },
  { key: "avgPizzas", label: <>Average Pizzas <br />per Order</> },
  { key: "avgFrequencyWeeks", label: <>Avg Ordering<br />Frequency (wks)</> },
  { key: "avgPizzasPerWeek", label: <>Avg Pizzas<br />per Week</> },
  { key: "weeklyRank", label: <>Weekly<br />Rank</> }
];

function OrderingHabitsByCustomer({ orders = [] }) {
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [searchTerm, setSearchTerm] = useState("");

  const topScrollbarRef = useRef(null);
  const tableScrollbarRef = useRef(null);

  // Sync scroll position between top scrollbar and table scrollbar
  useEffect(() => {
    const top = topScrollbarRef.current;
    const table = tableScrollbarRef.current;
    if (!top || !table) return;

    const syncScroll = (source, target) => {
      source.addEventListener("scroll", () => {
        target.scrollLeft = source.scrollLeft;
      });
    };
    syncScroll(top, table);
    syncScroll(table, top);

    return () => {
      top.removeEventListener("scroll", () => {});
      table.removeEventListener("scroll", () => {});
    };
  }, []);

  // Group orders by customer name and calculate stats
  const customers = useMemo(() => {
    const map = {};
    orders.forEach(order => {
      const name = order.customer_name || order.customerName || "Unknown";
      const deliveryDate = order.delivery_day || order.deliveryDate;
      const pizzasInOrder = Object.values(order.pizzas || {}).reduce(
        (sum, pizza) => sum + (pizza.quantity || 0), 0
      );
      if (!map[name]) map[name] = [];
      map[name].push({
        date: deliveryDate,
        pizzas: pizzasInOrder
      });
    });

    // Calculate stats for each customer
    const customerStats = Object.entries(map).map(([name, orders]) => {
      const totalPizzas = orders.reduce((sum, o) => sum + o.pizzas, 0);
      const lastOrder = orders.reduce((latest, o) =>
        !latest || new Date(o.date) > new Date(latest.date) ? o : latest, null
      );
      const avgPizzas = orders.length ? Math.round(totalPizzas / orders.length) : 0;

      // Calculate weeks between first and last order (inclusive)
      const dates = orders.map(o => new Date(o.date)).sort((a, b) => a - b);
      let weeksBetween = 1;
      if (dates.length > 1) {
        const daysBetween = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
        weeksBetween = Math.max(1, Math.round(daysBetween / 7));
      }
      const avgPizzasPerWeek = weeksBetween ? Math.round(totalPizzas / weeksBetween) : totalPizzas;

      let avgFrequencyWeeks = "-";
      if (dates.length > 1) {
        const daysBetween = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
        avgFrequencyWeeks = Math.round(daysBetween / orders.length / 7);
      }

      return {
        name,
        totalPizzas,
        lastDeliveryDate: lastOrder?.date || "-",
        weeksAgo: lastOrder?.date ? weeksAgo(lastOrder.date) : "-",
        pizzasLastDelivery: lastOrder?.pizzas || "-",
        avgPizzas,
        avgFrequencyWeeks,
        avgPizzasPerWeek
      };
    });

    // Assign overall rank (total pizzas)
    customerStats
      .sort((a, b) => b.totalPizzas - a.totalPizzas)
      .forEach((customer, idx) => {
        customer.rank = idx + 1;
      });

    // Assign weekly rank (avg pizzas per week)
    [...customerStats]
      .sort((a, b) => b.avgPizzasPerWeek - a.avgPizzasPerWeek)
      .forEach((customer, idx) => {
        customer.weeklyRank = idx + 1;
      });

    return customerStats;
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
      <div className="searchCustomer">
        <input
          type="text"
          placeholder="Search customer..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
      <div style={{ display: "flex" }}>
        {/* Fixed first column */}
        <table className="stockTable customerTableFixed">
          <thead>
            <tr>
              <th>
                Customer Name
                <span
                  className="filter"
                  style={{ marginLeft: 6 }}
                  onClick={() => {
                    if (sortField === "name") {
                      setSortDirection(d => (d === "asc" ? "desc" : "asc"));
                    } else {
                      setSortField("name");
                      setSortDirection("asc");
                    }
                  }}
                >
                  <FontAwesomeIcon icon={faSort} />
                  {sortField === "name" && (sortDirection === "asc" ? "▲" : "▼")}
                </span>
              </th>
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
        <div className="customerTableScrollContainer">
          <div
            id="table-scrollbar"
            ref={tableScrollbarRef}
            className="customerTableScrollable"
          >
            <table className="stockTable customerTableWide">
              <thead>
                <tr>
                  {SORT_FIELDS.map(field => (
                    <th key={field.key}>
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
                    <td>{customer.rank}</td>
                    <td>{customer.totalPizzas}</td>
                    <td>{customer.lastDeliveryDate !== "-" ? formatDateDMY(customer.lastDeliveryDate) : "-"}</td>
                    <td>{customer.weeksAgo}</td>
                    <td>{customer.pizzasLastDelivery}</td>
                    <td>{customer.avgPizzas}</td>
                    <td>{customer.avgFrequencyWeeks}</td>
                    <td>{customer.avgPizzasPerWeek}</td>
                    <td>{customer.weeklyRank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderingHabitsByCustomer;
