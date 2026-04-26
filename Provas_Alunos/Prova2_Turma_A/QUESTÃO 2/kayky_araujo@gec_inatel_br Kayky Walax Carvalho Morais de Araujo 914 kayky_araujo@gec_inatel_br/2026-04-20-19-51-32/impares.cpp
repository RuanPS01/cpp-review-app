#include <iostream>

using namespace std;

int main(){
    
    int X;
    
    cin >> X;
    
    while(X < 1 || X > 1000){
       cin >> X; 
    }
    
    for(int i = 0; i <= X; i++){
        int analise = i;
        
        if(analise % 2 != 0){
            cout << analise << " ";
        }
    }
    
    return 0;
}