#include <iostream>
using namespace std;

int main(){
    
    int n;
    int num;
    
    
    cin >> n;
    
    for(int i = 0; i < n; i ++){
        cin >> n;
        
        if(num % 3 == 0){ 
            num ++;
        }
      
        cout << n << endl;
    }
    return 0;
}