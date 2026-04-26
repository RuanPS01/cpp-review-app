#include <iostream>

using namespace std;

int main(){
    
    int X, impar;
    
    cin >> X;
    
    if(X >= 1 && X <=1000){
        while(X % 1 == 0){
            X += impar;
            impar++;
        }
        cout << impar << endl;
    }
    return 0;
}