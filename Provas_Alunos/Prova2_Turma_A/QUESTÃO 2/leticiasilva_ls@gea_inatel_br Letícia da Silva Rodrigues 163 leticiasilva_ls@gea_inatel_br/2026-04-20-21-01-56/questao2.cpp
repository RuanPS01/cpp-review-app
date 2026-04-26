#include <iostream>

using namespace std;

int main(){
    
    int X;
    int impar = 0, valores = 0;
    
    cin >> X;
    
    for(int i = 0; i < X; i++){
        
        if(X % 2 != 0){
            
            impar = X;
            
        }
        
        cout << impar;
}

   return 0;

}