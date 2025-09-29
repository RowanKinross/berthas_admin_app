# Bertha's Admin App

## Project Status
This project is a work in progress.

## Description
Bertha's Admin App is a tool that has many aspects to it, but works predominantly as an ordering and stock management system. Orders can be added, maintained, customers can have data stored such as names, addresses, contact details. Stock is meticulously logged with batch codes for each ingredient, pizza weights, dates and a record of completion. Depending on the user role logged in, the app will display more or less information and give varying editing rights respectively, giving a heirarchy of access for data security.  The aim of the project was to make managing orders and stock easier than the existing system of complex spreadsheets. This is to alleviate chances of input errors and reading errors, mainly for packing orders, and to better visualise stock we do have to make planning more autonmous across the staff team. Users can input orders with automatic checks in place to reduce user error. They can see all the orders in existence, colour coded with completion/packed etc, making handover of jobs much simpler. Printouts can be made for invoicing and packing lists in a matter of seconds, superior to the previous method of typing or handwriting each individually and with the risk of copy errors. The unit team can add batch codes to be stored digitally and with the aid of autofill, long batch codes used week on week can be inputted within an instant. A prep list is automatically generated for the week, meaning staff can rock up and see clearly what needs to be prepped and with each ingredient optionally displaying built-in prep notes. Overall this app poses many benefits to streamlining daily processes and visual clarity on stock and demand. The project makes use of html, css, javascript/react, node, firestore, vite, copilot and netlify. <br>
https://berthas-frozen-admin.netlify.app/
  
## Table of Contents
[Project Status](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#project-status) <br>
[Description](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#description) <br>
[Installation](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#installation) <br>
[Usage](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#usage) <br>
[Demo](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#demo) <br>
[License](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#license) <br>
[Contributors](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#contributors) <br>
[Credits](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#credits) <br>
[Tests](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#tests) <br>
[Questions](https://github.com/RowanKinross/berthas_admin_app?tab=readme-ov-file#questions)
  
## Installation
n/a

## Usage
Upon opening the project, the user is met with a navigatory home page displaying a welcome message, a Bertha's at Home logo and a login button. By clicking on login, the user is shown a selection of three user roles: 'Unit Team', 'Admin Team' & 'Customers'. Once clicking on a user role, an input box appears for entering a password. If the correct password has been entered, the relative nav-bar displays. The 'Unit Team' can see two tabs - 'Batches' (displaying the week's batches, clickable buttons, with the pizzas listed, their quantities, 3 weights fields and all the ingredients necessary for the batch, with clickable inputs for batch/lot numbers) and 'Prep' (where the unit team can see a prep list and a required mixes for that week). The 'Admin Team', upon logging in can see seven tabs - 'Orders' (a list of placed orders across all customers, clickable for editing, managing numbers and assigning batches and buttons for printing order lists and packing slips for across multiple orders), 'New Order' (an order form for placing an order on behalf of a customer), 'Inventory' (displaying all current stock in the freezer), 'Demand Summary' (a display of current stock, planned stock, ordering habits etc for planning and maintaining stock levels), 'Archive' (for all stock that has been sent/used in order to have a record for recall or batch code checks), 'Batches' (similar to the unit team view only with extra features like adding new batches, searching batches, and all batches can be seen rather than the week ahead's) and finally 'Prep' (where a dough plan can be made and where the prep list is again displayed). The 'Customers' login leads us to select a customer or add a customer. They can then see three tabs - 'New Order' (form for placing an order), 'Order History' (a series of display buttons for clickable orders and their details) and 'Account Info'. The customer login is a work in progress and the only aspect not yet used in the live environment.

## Demo
![demo]() 
(still to add)

## License
MIT License

## Contributors
n/a

## Credits
Bertha's Pizza, Bristol, for the opportunity.

## Tests
n/a

## Questions
If you have any further questions you can find me here: <br>
GitHub - https://github.com/RowanKinross <br>
linkedIn - https://www.linkedin.com/in/rowan-kinross-512940284/
