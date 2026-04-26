#include <iostream>

using namespace std;

int main(){
    
    int A,R,N;
    
    int res=0;
    
    cin >> N ;
    cin >> A ;
    cin >> R ;

    
    for (int i=0; i < N ; i++){
    
        cout << A << " " ;
        
        res=A + R;
        
        i+1;
        
        A=res;
    
    }    
   
    
    
    
    return 0;
}