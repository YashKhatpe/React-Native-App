import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Button,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from "react-native";
import { getDatabase, ref, onValue, get, set, push } from "@firebase/database";
import * as Contacts from "expo-contacts";
import { Ionicons } from "@expo/vector-icons";
import { useFirebase } from "../context/AuthContext";
import { StatusBar } from "expo-status-bar";

const FriendsScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [showSelectedFriends, setShowSelectedFriends] = useState(true);
  const [usersFriends, setUsersFriends] = useState(null);
  const [filteredFriendsNo, setFilteredFriendsNo] = useState([]);
  const firebase = useFirebase();
  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  useEffect(() => {
    console.log("User Login Status: ", firebase.isLoggedIn);
    console.log("User Name: ", firebase.userName);
    const fetchData = async () => {
      const db = getDatabase();
      if (firebase.user) {
        const userId = await firebase.user.uid;
        const path = `users/accounts/${userId}/friendsList`;
        const friendsRef = ref(db, path);

        const unsubscribe = onValue(friendsRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const friendsArray = Object.entries(data).map(([key, value]) => ({
              key: key,
              value: value,
            }));
            setUsersFriends(friendsArray);
            console.log("Friends array: ", friendsArray);
          } else {
            setUsersFriends([]);
          }
        });

        return () => unsubscribe();
      }
    };
    fetchData();
  }, [firebase.user]);

  const handleLoadContacts = async () => {
    if (hasPermission) {
      const { data } = await Contacts.getContactsAsync();
      // console.log("Data: ", data);
      if (data.length > 0) {
        setContacts(data);
        setShowSelectedFriends(false);
      }
    }
    console.log("In load contacts function");
    console.log("Selected Contacts: ", selectedFriends);
  };
  const handleLoadContactsAgain = async () => {
    setShowSelectedFriends(false);
    setLoadContactsAgain(true);

    console.log("In load contacts again function");
    console.log("Selected Contacts: ", selectedFriends);
    // console.log('Contacts: ',contacts);
  };

  const handleFriendSelection1 = (contact) => {
    const uid = firebase.user.uid;
    const isSelected = selectedFriends.some(
      (friend) => friend.contactInfo.id === contact.id
    );
    console.log("isSelected: ", isSelected);
    const updatedSelectedFriends = isSelected
      ? selectedFriends.filter((friend) => friend.contactInfo.id !== contact.id)
      : [
          ...selectedFriends,
          {
            contactInfo: contact,
            phoneNo: contact.phoneNumbers[0].number,
            senderFriend: uid,
          },
        ];
    setSelectedFriends(updatedSelectedFriends);
  };

  const handleAddFriends = async () => {
    // Add selected friends to Firebase
    const userId = await firebase.user.uid;

    // Filter out added friends from the contacts state
    const remainingContacts = contacts.filter((contact) => {
      // Check if the contact is not in the selectedFriends array
      return !selectedFriends.some(
        (selectedFriend) => selectedFriend.contactInfo.id === contact.id
      );
    });

    // Store remaining contacts in the state
    setContacts(remainingContacts); // No same contacts will be displayed to user which is akready being added as a friends

    // Store selected friends in the database
    try {
      const db = getDatabase();

      const pendingFriendPath = `users/pendingFriends`;
      const pendingFriendRef = ref(db, pendingFriendPath);

      const searchRef = ref(db, "users/accounts");
      const snapshot = await get(searchRef);

      for (const friend of selectedFriends) {
        let found = false;
        snapshot.forEach(async (childSnapshot) => {
          const snapshotPhoneNo = await firebase.normalizePhoneNumber(
            childSnapshot.val().phoneNumber
          );
          const friendPhoneNo = await firebase.normalizePhoneNumber(
            friend.phoneNo
          );
          console.log("Comparing two numbers:", snapshotPhoneNo, friendPhoneNo);
          if (
            snapshotPhoneNo === friendPhoneNo ||
            snapshotPhoneNo === `91${friendPhoneNo}` ||
            `91${snapshotPhoneNo}` === friendPhoneNo
          ) {
            console.log("Match Found...");
            found = true;
            const fuid = await childSnapshot.val().uid;
            const addFriendRef = ref(
              db,
              `users/accounts/${userId}/friendsList/${fuid}`
            );
            const childSnapVal = await childSnapshot.val();
            await set(addFriendRef, childSnapVal);
            // Adding the user as a friend on the other side also
            const addFriendRefFromOtherEnd = ref(
              db,
              `users/accounts/${fuid}/friendsList/${userId}`
            );
            const friendData = firebase.userDetails;
            await set(addFriendRefFromOtherEnd, friendData);
            console.log("Friends Data: ", friendData);
          }
        });
        if (!found) {
          // If user not found then push the data to users/pendingFriends
          const data = {
            phoneNo: friend.phoneNo,
            senderFriend: userId,
          };
          await push(pendingFriendRef, data);
        }
      }

      setSelectedFriends([]);
      console.log("Selected  friends added to the database successfully");
    } catch (error) {
      console.error(
        "Error adding selected friends to the database:",
        error.message
      );
    }
    console.log(" Selected friends: ", selectedFriends);
    setShowSelectedFriends(true);
  };

  const MyListItem = ({ item }) => {
    console.log("Contact info passed to MyListItem:", item);

    const handleItemClick = () => {
      // Navigate to the screen where you want to split the bill
      navigation.navigate("SingleSplitBillScreen", { friend: item });
    };

    return (
      <TouchableOpacity style={styles.contactItem} onPress={handleItemClick}>
        <Ionicons
          style={styles.ionicon}
          name={"ios-call"}
          size={50}
          color={"green"}
        />

        <Text style={styles.contactName}>{item.value.username}</Text>
      </TouchableOpacity>
    );
  };

  return (
    // Displaying all the contacts
    <View style={{flex: 1}}>
      <StatusBar style="dark" />
      <ScrollView>
        {!showSelectedFriends && (
          <View>
            {contacts.length > 0 ? (
              contacts.map((contact) => (
                <TouchableOpacity
                  style={styles.contactItem}
                  key={contact.id}
                  onPress={() => handleFriendSelection1(contact)}
                >
                  {contact.imageAvailable ? (
                    <Image
                      source={{ uri: contact.image.uri }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 25,
                        marginLeft: 10,
                      }}
                    />
                  ) : (
                    <Ionicons
                      style={styles.ionicon}
                      name={"ios-call"}
                      size={50}
                      color={"green"}
                    />
                  )}
                  <Text style={styles.contactName}>{contact.name}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <>
                <View>
                  <Text>No contacts found</Text>
                </View>
              </>
            )}
          </View>
        )}

        <>
          {/* // Displaying load contacts button and friends added   */}
          {showSelectedFriends && (
            <View style={{ height: "100%", borderWidth: 1 }}>
              <View>
                {usersFriends &&
                  usersFriends.map((item) => (
                    <MyListItem key={item.key} item={item} />
                  ))}
              </View>
            </View>
          )}
        </>
      </ScrollView>
      <TouchableOpacity
        className=" p-3 m-3 absolute bottom-5 right-0 h-18 "
        style={{
          backgroundColor: "#66bb6a" ,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: 60,
          width: 60,
          height: 60,
        }}
        onPress={handleLoadContacts}
      >
        <Text style={{ fontSize: 25, alignContent: "center" }}>+</Text>
      </TouchableOpacity>

      {/* Displaying the button to add the selected friends to db at the bottom */}

      {!showSelectedFriends && selectedFriends.length > 0 && (
        <TouchableOpacity
          onPress={handleAddFriends}
          style={{
            alignItems: "center",
            paddingVertical: 16,
            backgroundColor: "#4E99F5",
          }}
        >
          <Text style={{ fontSize: 20 }}>Add Selected Friends</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  listContainer: {
    flexGrow: 1,
  },
  contactItem: {
    flexDirection: "row",
    paddingVertical: 10,
    // borderBottomWidth: 1,
    // borderBottomColor: "#ccc",
    pointerEvents: "box-none",
  },
  contactName: {
    height: 35,
    marginLeft: 2,
    marginTop: 5,
    paddingLeft: 20,
    paddingHorizontal: 8,
    fontSize: 18,
    fontWeight: "bold",
    color: "black",
  },
  addbuttonview: {
    position: "absolute",
    bottom: 0,
  },
  addbutton: {
    height: "80",
    width: "80",
  },
  ionicon: {
    marginLeft: 2,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingLeft: 20,
    fontSize: 18,
    fontWeight: "bold",
  },
  contactNumber: {
    fontSize: 16,
    color: "#666",
  },
  floatBtn: {
    position: "absolute",
    bottom: 60,
    right: 20,
  },
});
export default FriendsScreen;
