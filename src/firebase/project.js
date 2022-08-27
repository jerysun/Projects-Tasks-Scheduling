/* eslint-disable no-throw-literal */
import { db } from './firebase';
import { user } from './user';
import { collection, setDoc, doc, getDoc, getDocs, query, where, orderBy, onSnapshot, addDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { ref, onUnmounted, watch } from 'vue';

export const prepareProjectData = async () => {
  const projectsRef = collection(db, 'projects');
  await Promise.all([
    setDoc(doc(projectsRef, 'first'), {
      name: 'First project',
      taskCount: 5,
      taskDoneCount: 2
    }),
    setDoc(doc(projectsRef, 'second'), {
      name: 'Second project',
      taskCount: 10,
      taskDoneCount: 7
    }),
    setDoc(doc(projectsRef, 'third'), {
      name: 'Third project',
      taskCount: 2,
      taskDoneCount: 2
    }),
    setDoc(doc(projectsRef, 'fourth'), {
      name: 'Fourth project',
      taskCount: 4,
      taskDoneCount: 3
    })
  ]);
  console.log('Documents should be added now!');
};

export const fetchAllDocuments = async () => {
  const projectsRef = collection(db, 'projects');
  const result = await getDocs(projectsRef);
  logResults(result);
};

export const queryProjects = async () => {
  const projectRef = collection(db, 'projects');
  const q = query(
    projectRef,
    where('taskCount', '>', 2),
    where('taskCount', '<=', 6),
    orderBy('taskCount')
  );
  const result = await getDocs(q);
  logResults(result);
};

const logResults = (result) => result.forEach(doc => console.log({ id: doc.id, ...doc.data() }));

export const fetchSingleDocument = async () => {
  const docRef = doc(db, 'projects', 'first');
  const projectDoc = await getDoc(docRef);

  if (projectDoc.exists()) {
    console.log({
      id: projectDoc.id,
      ...projectDoc.data()
    });
  } else {
    console.log('The document does not exist!');
  }
};

export const watchDocument = async () => {
  // Use return to give the handle to the caller for resource release
  return onSnapshot(
    doc(db, 'projects', 'first'),
    (doc) => console.log(doc.data())
  );
};

export const watchProjectsWithDoneTasks = async () => {
  const q = query(
    collection(db, 'projects'),
    where('taskDoneCount', '>', 0)
  );// Use return to give the handle to the caller for resource release
  return onSnapshot(q, (querySnapshot) => logResults(querySnapshot));
};

export const useQueryProjects = () => {
  const projects = ref([]);
  let unsub = () => {};

  watch(user, (user) => {
    if (!user || !user.uid) {
      return;
    }

    const q = query(
      collection(db, 'projects'),
      where('uid', '==', user.uid)
    );
    unsub();
    unsub = onSnapshot(q, (snapshot) => {
      projects.value = snapshot.docs.map(
        doc => ({
          id: doc.id,
          ...doc.data()
        })
      );
    });
  });

  onUnmounted(() => {
    unsub();
    console.log('Unsub tasks...');
  });
  return projects;
};

export const useQueryTasks = (projectId) => {
  const taskList = ref([]);
  let unsub = () => {};

  watch(projectId, (projectId, oldProjectId) => {
    if (projectId === null || projectId === undefined) {
      console.log('projectId is nullish');
      taskList.value = [];
      return;
    }
    console.log(`Not watching ${oldProjectId} tasks anymore...`);
    unsub();
    // The last argument 'tasks' is the name of the subcollection
    const q = query(collection(db, 'projects', projectId, 'tasks'), orderBy('timestamp', 'desc'));
    console.log(`Watching ${projectId} tasks`);
    unsub = onSnapshot(q, (snapshot) => {
      taskList.value = snapshot.docs.map(
        doc => ({
          id: doc.id,
          ...doc.data()
        })
      );
    });
  });
  onUnmounted(unsub);
  return taskList;
};

export const addProject = async (name = '') => {
  // addDoc() lets firestore to create Id for you, if you don't like this
  // feature, then use setDoc()
  const project = await addDoc(
    collection(db, 'projects'),
    {
      name,
      taskCount: 1,
      taskDoneCount: 0,
      uid: user.value.uid
    }
  );
  await addDoc(
    collection(db, 'projects', project.id, 'tasks'),
    {
      description: 'First task',
      done: false,
      priority: false,
      timestamp: serverTimestamp(),
      uid: user.value.uid
    }
  );
  return project;
};

// export const deleteTask = async (projectId, taskId) => {
//   await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId));
// };

const getProjectInTransaction = async (transaction, projectId) => {
  const projectDocRef = doc(db, 'projects', projectId);
  const projectDoc = await transaction.get(projectDocRef);

  if (!projectDoc.exists()) {
    throw 'Project does not exist!';
  }

  return {
    projectDocRef,
    projectDoc,
    projectData: projectDoc.data()
  };
};

const getTaskInTransaction = async (
  transaction, projectId, taskId
) => {
  const taskDocRef = doc(
    db, 'projects', projectId, 'tasks', taskId
  );
  const taskDoc = await transaction.get(taskDocRef);

  if (!taskDoc.exists()) {
    throw 'Task does not exist';
  }

  return {
    taskDocRef,
    taskDoc,
    taskData: taskDoc.data()
  };
};

export const addTask = async (projectId, task) => {
  await runTransaction(db, async (transaction) => {
    // In runTransaction() body, always in this order:
    // First is READ operation
    const { projectDocRef, projectData } = await getProjectInTransaction(transaction, projectId);
    const taskCount = projectData.taskCount + 1;

    // SECOND is the WRITE operation
    const taskDocRef = doc(collection(db, 'projects', projectId, 'tasks'));
    // append task to taskDocRef, like the insert of sql
    transaction.set(taskDocRef, {
      timestamp: serverTimestamp(),
      uid: user.value.uid,
      ...task
    });
    transaction.update(projectDocRef, { taskCount });
  });
};

export const updateTask = async (projectId, task) => {
  await runTransaction(db, async (transaction) => {
    const { projectDocRef, projectData } =
      await getProjectInTransaction(
        transaction, projectId
      );

    const { taskDocRef, taskData } = await getTaskInTransaction(transaction, projectId, task.id);

    let taskDoneCount = projectData.taskDoneCount;

    if (task.done === true && !taskData.done) {
      taskDoneCount++;
    } else if (task.done === false && taskData.done) {
      taskDoneCount--;
    }

    const { id, ...data } = task;// id should be excluded, it shouldn't be updated!
    transaction.update(taskDocRef, data);
    transaction.update(projectDocRef, { taskDoneCount });
  });
};

export const deleteTask = async (projectId, taskId) => {
  await runTransaction(db, async (transaction) => {
    const { projectDocRef, projectData } = await getProjectInTransaction(transaction, projectId);
    const { taskDocRef, taskData } = await getTaskInTransaction(
      transaction, projectId, taskId
    );
    const taskCount = projectData.taskCount - 1;
    const taskDoneCount = projectData.taskDoneCount - (taskData.done ? 1 : 0);

    transaction.delete(taskDocRef);
    transaction.update(projectDocRef, { taskCount, taskDoneCount });
  });
};

export const moveTask = async (fromProjectId, toProjectId, taskId) => {
  await runTransaction(db, async (transaction) => {
    // Here, the fromRef and fromData are called ALIAS, so are the toRef and toData
    const { projectDocRef: fromRef, projectData: fromData } = await getProjectInTransaction(transaction, fromProjectId);
    const { projectDocRef: toRef, projectData: toData } =
      await getProjectInTransaction(
        transaction, toProjectId
      );
    const { taskDocRef, taskData } = await getTaskInTransaction(
      transaction, fromProjectId, taskId
    );

    transaction.update(fromRef, {
      taskCount: fromData.taskCount - 1,
      taskDoneCount: fromData.taskDoneCount -
        (taskData.done ? 1 : 0)
    });
    transaction.update(toRef, {
      taskCount: toData.taskCount + 1,
      taskDoneCount: toData.taskDoneCount +
        (taskData.done ? 1 : 0)
    });

    const newTaskDocRef = doc(collection(db, 'projects', toProjectId, 'tasks'));
    transaction.set(newTaskDocRef, taskData);
    transaction.delete(taskDocRef);
  });
};
