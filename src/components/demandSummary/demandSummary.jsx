import { useState, useEffect} from 'react';
import './demandSummary.css'

const demandSummary = []

function DemandSummary() {
  return (
    <div className='demandSummary'>
      <h2>DEMAND SUMMARY</h2>
      {demandSummary.length > 0 ? (
        <p>{demandSummary}</p>
      ):(
        <p className='py-3'>Loading demand summary...</p>
      )}
    </div>
  )
}

export default DemandSummary;
