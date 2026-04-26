#include <iostream>
using namespace std;

int main(){
    
    int X = 0;
    
    cin >> X;
    
    for(int i = 1; i <= X; i += 2){
        cout << i << " ";
    }
    
    return 0;
}