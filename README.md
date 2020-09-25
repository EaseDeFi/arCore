# armor

 Rough drafts of the ARMOR contracts (rough as in not compile-able).


They here are some big things wrong with these and I bet plenty of small ones:


1. Some constructors require each other.

2. Using getNFT in LendManager but the function doesn’t exist, need to change how we get those parameters by grabbing one at a time. All variables using it are right, but we need to get separately.

3. Some function calls to NexusMutual are not correct.

4. General cleanliness, comments, etc.


I’m just uploading now to show the general strategies we’re working with, see what other people think, if we should go different directions, etc. Feel free to make any changes, but I’ll be on tomorrow to fix those things above, go over everything again to get some more of the smaller things, and make any protocol changes we need.
