import { createContext, useContext, useState, useEffect } from "react";
import { initializeApp } from "@firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "@firebase/auth";
import {
  getDatabase,
  set,
  get,
  ref,
  remove
} from "@firebase/database";
import firebaseConfig from "./firebaseConfig";
import 'firebase/database';

// Initialize Firebase app
export const firebaseApp = initializeApp(firebaseConfig);
export const database = getDatabase(firebaseApp);
export const firebaseAuth = getAuth(firebaseApp);

const FirebaseContext = createContext(null);

export const useFirebase = () => useContext(FirebaseContext);

export const authStateChanged = onAuthStateChanged;

export const FirebaseProvider = (props) => {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setUser(user);
      // console.log('User: ',user);
    });

    // Cleanup function
    return () => unsubscribe();
  }, []);


useEffect(() => {
    if (isLoggedIn) {
      const getUname = async() => {
        const uname = await getUsernameFromUid(user.uid);
      }
    return () => getUname();
  }
  }, [user, userName]);  

  const isLoggedIn = !!user;

  // Sign Up Context
  const signupUserWithEmailAndPass = async (email, username, password, phoneNumber) => {
    // Create user account with email
    const db = getDatabase();
    try {
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password
        );
        if(userCredential){
          setUserName(username)
          const userDetails = {
            username,
            email,
            phoneNumber,
            uid: userCredential.user.uid
          };
          // Write to secure path with appropriate security rules
          const usernameRef = ref(db, `users/accounts/${userDetails.uid}`);
          await set(usernameRef, userDetails);
          console.log(userCredential);
          console.log('User added successfully to the database');

          await checkPhoneNoWhenNewAcc(phoneNumber, userDetails);
          return true;
        }
      } catch (error) {
        console.log('Error signing up user: ', error.message);
        throw error;
      }
      };

      const checkPhoneNoWhenNewAcc = async (phoneNumber, userDetails) => {
        const db = getDatabase();
         // Check if the user's phone number exists in pendingFriends
         const pendingFriendsRef = ref(db, 'users/pendingFriends');
         const pendingFriendsSnapshot = await get(pendingFriendsRef);

         if (pendingFriendsSnapshot.exists()) {
             pendingFriendsSnapshot.forEach(async (childSnapshot) => {
                 const pendingPhoneNumber = childSnapshot.val().phoneNo;
                 const senderId = childSnapshot.val().senderFriend;

                 if (pendingPhoneNumber === phoneNumber) {
                     console.log('Matching phone number found in pendingFriends');

                     const userAccountRef = ref(db, `users/accounts/${senderId}/friendsList`);
                     await set(userAccountRef, userDetails);
                     console.log('Successfully added friend from the pending list');

                     await remove(childSnapshot.ref);
                 }
             });
         }
      }



    const getUsernameFromUid = async (uid) => {
      const db = getDatabase();
      const userRef = ref(db, `users/accounts/${uid}/username`);
       try {
        const snapShot = await get(userRef);
        if(snapShot.exists()){
          return snapShot.val();
        } else {
          throw new Error('Username not found from the given Uid')
        }
      } catch (error) {
        console.log('Error fetching username: ', error.message);
        throw error;
      }
    }


  
  

  // Login Context
 

  const getUsernameFromEmail = async (email) => {
    try {
      const db = getDatabase();
      // Reference the database path where user data is stored
      const usersRef = ref(db, 'users/accounts');
  
      // Get a snapshot of the users node
      const snapshot = await get(usersRef);
  
      // Check if the snapshot exists and has any data
      if (snapshot.exists()) {
        // Loop through each child node (which represent a UID)
        const userData = snapshot.val();
        for (const uid in userData) {
          if (Object.hasOwnProperty.call(userData, uid)) {
            const userDataByUsername = userData[uid];
            // Check if the username of the user matches the provided username
            if (userDataByUsername.email === email) {
              // If matched, return the email of the user
              return userDataByUsername.username;
            }
          }
        }
      }
  
      // If no matching user found, return null or throw an error
      return null; // Or throw new Error('User not found') depending on your preference
    } catch (error) {
      console.error('Error retrieving username from email:', error);
      throw error;
    }
  };

  const getEmailFromUsername = async (username) => {
    try {
      const db = getDatabase();
      // Reference the database path where user data is stored
      const usersRef = ref(db, 'users/accounts');
  
      // Get a snapshot of the users node
      const snapshot = await get(usersRef);
  
      // Check if the snapshot exists and has any data
      if (snapshot.exists()) {
        // Loop through each child node (which represent a UID)
        const userData = snapshot.val();
        for (const uid in userData) {
          if (Object.hasOwnProperty.call(userData, uid)) {
            const userDataByUsername = userData[uid];
            // Check if the username of the user matches the provided username
            if (userDataByUsername.username === username) {
              // If matched, return the email of the user
              return userDataByUsername.email;
            }
          }
        }
      }
  
      // If no matching user found, return null or throw an error
      return null; // Or throw new Error('User not found') depending on your preference
    } catch (error) {
      console.error('Error retrieving email from username:', error);
      throw error;
    }
  };
  
  
  
  
  const isValidEmail = (input) => {
    // Use a regex pattern to check if the input matches the email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  };

  const loginUserWithEmailAndPass = async (emailOrUsername, password) => {
    let email;
    if (isValidEmail(emailOrUsername)) {
      email = await emailOrUsername;
      const userName = await getUsernameFromEmail(email);
      setUserName(userName);
    } else {
      try {
        email = await getEmailFromUsername(emailOrUsername);
        setUserName(emailOrUsername);
        console.log("Email fetched: ". email);
      } catch (error) {
        console.error('Error retrieving email from username:', error.message);
        return null; // Return null or handle the error as needed
      }
    }
    const logIn = await signInWithEmailAndPassword(firebaseAuth, email, password);
    if(logIn){
      return true; 
    }
  };
  //SingOut Context
  const signUserOut = () => {
    return signOut(firebaseAuth);
  };

  // const signInWithGoogle = () => {
  //   signInWithPopup(firebaseAuth, provider);
  // }

  // Adding data to realtime database
  const putData = async (path, data) => {
    const ref = ref(database, path)
    await set(ref, data);
  } 
  const getData = async (path) => {
    const reF = ref(database, path)
    const snapshot = await get(reF);
    const result = snapshot.val() || null;
    return result;
  } 


  const checkPhoneNumberExists = async (phoneNumber) => {
    try {
        const usersRef = ref(database, 'users/accounts');
        const snapshot = await get(usersRef);

        if (snapshot.exists()) {
            // Iterate over each user (uid)
            for (const uid in snapshot.val()) {
                const userData = snapshot.val()[uid];
                // Check if the phone number exists in the user's data
                if (Object.values(userData).includes(phoneNumber)) {
                    // If found, return true
                    return true;
                }
            }
        }
        // If the phone number is not found in any user's data, return false
        return false;
    } catch (error) {
        console.error('Error checking phone number existence:', error);
        return null;
    }
};


const checkUserNameExists = async (username) => {
  try {
      const usersRef = ref(database, 'users/accounts');
      const snapshot = await get(usersRef);

      if (snapshot.exists()) {
          // Iterate over each user (uid)
          for (const uid in snapshot.val()) {
              const userData = snapshot.val()[uid];
              // Check if the username exists in the user's data (case-insensitive)
              const usernames = Object.values(userData).map(value => value.toLowerCase());
              if (usernames.includes(username.toLowerCase())) {
                  // If found, return true
                  return true;
              }
          }
      }
      // If the username is not found in any user's data, return false
      return false;
  } catch (error) {
      console.error('Error checking username existence:', error);
      return null;
  }
};



  return (
    <FirebaseContext.Provider
      value={{
        signupUserWithEmailAndPass,
        loginUserWithEmailAndPass,
        signUserOut,
        putData,
        getData,
        isLoggedIn,
        user,
        setUser,
        userName,
        setUserName,
        getUsernameFromUid,
        checkPhoneNumberExists,
        checkUserNameExists
      }}
    >
      {props.children}
    </FirebaseContext.Provider>
  );
};

