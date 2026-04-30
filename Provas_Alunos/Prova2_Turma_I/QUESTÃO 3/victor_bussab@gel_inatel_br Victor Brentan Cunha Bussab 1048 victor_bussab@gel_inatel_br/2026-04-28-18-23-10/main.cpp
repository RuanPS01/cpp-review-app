#include <iostream>
using namespace std;

int main (){
    
    
    float add1 = 0, add2 = 0, add3 = 0, add4 = 0, add5 = 0; // so para fazer a contagem
    int num = 0;
    
    do{
        cin >> num;
        
        if(num == '1')
            add1++;
            
        else if(num == '2')
            add2++; 
            
        else if(num == '3')
            add3++;
            
        else if(num == '4')
            add4++;
        else if(num == '5')
            add5++;  
        
    }while(num == 6);
    
    cout << "1 estrela: " << add1 << " %" << endl;
    cout << "2 estrela: " << add2 << " %" << endl;
    cout << "3 estrela: " << add3 << " %" << endl;
    cout << "4 estrela: " << add4 << " %" << endl; 
    cout << "5 estrela: " << add5 << " %" << endl; 
    
    return 0;
}