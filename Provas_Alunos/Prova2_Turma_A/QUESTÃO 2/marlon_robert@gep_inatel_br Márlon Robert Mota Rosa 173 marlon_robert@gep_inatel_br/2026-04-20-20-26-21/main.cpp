#include <iostream>

using namespace std;

int main(){
    
    int X ;
    
    cin >> X ;
    
    int num[1000];
    
    
    for (int i=1 ; i <= X ; i++){
        
        num[i]=0+i;
        
        i++;
    }
    for(int i =1 ; i <= X ; i++){
        if (num[i]%2!=0){
            cout << num[i] << " ";
        }
        
    }
    return 0;
}