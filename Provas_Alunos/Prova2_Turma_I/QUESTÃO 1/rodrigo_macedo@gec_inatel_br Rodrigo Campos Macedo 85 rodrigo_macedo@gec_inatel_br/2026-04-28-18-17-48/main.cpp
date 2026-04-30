#include <iostream>

using namespace std;

int main(){
    
   int N;
   int num;
   float divi = 0;
   
   cin >> N;
   
   for(int i =0; i < N; i++){
       cin >> num;
    
    if(num % 3 == 0){   
       divi++;
       }
       
   }
       
    cout << divi << endl;
    
    return 0;
}