import { collection, query, where, getDocs } from '@firebase/firestore';
import { db } from '../components/firebase/firebase';

export const fetchCustomerByAccountID = async (accountID) => {
  if (!accountID) return null;

  const customersRef = collection(db, 'customers');
  const q = query(customersRef, where('account_ID', '==', accountID));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data();
  }

  return null; // no match
};