// import berthasLogo from './bertha_logo'
import './goods.css';
import React, {useState, useEffect} from 'react';
import { app, db } from '../firebase/firebase';
import { collection, addDoc, getDocs, getDoc, doc, updateDoc } from '@firebase/firestore'; 
import { Dropdown, Button, Form } from 'react-bootstrap';

function Goods() {

  return (
    <div className='goods navContent'>
      <h2>GOODS IN</h2>
    </div>
        )
}

export default Goods;